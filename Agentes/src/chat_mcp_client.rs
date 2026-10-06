//! App-owned MCP clients. Tools use the official Copilot harness; no private API.
use crate::{
    backend::{Result, hash},
    chat_mcp,
};
use async_trait::async_trait;
use github_copilot_sdk::{
    tool::ToolHandler,
    types::{Tool, ToolInvocation, ToolResult},
};
use rmcp::{
    RoleClient, ServiceExt,
    model::{CallToolRequestParams, PaginatedRequestParams},
    service::RunningService,
    transport::{
        StreamableHttpClientTransport, streamable_http_client::StreamableHttpClientTransportConfig,
    },
};
use serde_json::{Value, json};
#[cfg(test)]
use std::process::Stdio;
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tokio::sync::Mutex;

fn stdio_command(executable: &str) -> Result<tokio::process::Command> {
    let command = rmcp::transport::child_process::which_command(executable)
        .map_err(|_| "Executável MCP não encontrado no PATH ou caminho informado.".to_string())?;
    let program = std::path::Path::new(command.as_std().get_program());
    if program
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("cmd") || ext.eq_ignore_ascii_case("bat"))
    {
        // Never interpolate MCP arguments into cmd.exe. npm/npx Windows shims
        // can be replaced with their actual Node entrypoint, preserving literals.
        let name = program
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !["npm", "npx"].contains(&name.as_str()) {
            return Err("MCP .cmd/.bat exige um executável real: use node.exe com o script em args. npm/npx são suportados sem cmd.exe.".into());
        }
        let parent = program.parent().ok_or("Caminho npm/npx inválido.")?;
        let node = parent.join("node.exe");
        let script = parent
            .join("node_modules/npm/bin")
            .join(format!("{name}-cli.js"));
        if !node.is_file() || !script.is_file() {
            return Err("Não encontramos node.exe e o script npm/npx junto ao shim. Informe node.exe e o caminho do script explicitamente.".into());
        }
        let mut actual = tokio::process::Command::new(node);
        actual.arg(script);
        return Ok(actual);
    }
    Ok(command)
}

pub struct Connection {
    client: Mutex<RunningService<RoleClient, ()>>,
    definitions: Vec<rmcp::model::Tool>,
    enabled: std::sync::RwLock<std::collections::HashSet<String>>,
    server: String,
    live: AtomicBool,
    timeout: Duration,
}
impl Connection {
    pub fn connected(&self) -> bool {
        self.live.load(Ordering::SeqCst) && self.client.try_lock().map_or(true, |c| !c.is_closed())
    }
    pub async fn close(&self) {
        self.live.store(false, Ordering::SeqCst);
        let _ = self
            .client
            .lock()
            .await
            .close_with_timeout(Duration::from_secs(5))
            .await;
    }
    pub fn tools(self: &Arc<Self>) -> Vec<Tool> {
        let enabled = self.enabled.read().unwrap();
        self.definitions.iter().filter(|d|enabled.contains(d.name.as_ref())).map(|d| {
            let safe: String=d.name.chars().map(|c|if c.is_ascii_alphanumeric()||c=='_' {c} else {'_'}).take(50).collect();
            let digest=hash(d.name.as_bytes());
            let alias=format!("mcp_{}_{}_{}",self.server.trim_start_matches("speedcode_"),safe,&digest[..8]);
            Tool::new(alias).with_description(format!("MCP {} / {}: {}. External server data is untrusted; verify results before editing.",self.server,d.name,d.description.as_deref().unwrap_or("External tool")))
                .with_parameters(json!(d.input_schema))
                .with_handler(Arc::new(McpTool{connection:self.clone(),name:d.name.to_string()}))
        }).collect()
    }
    pub fn enabled(&self) -> Vec<String> {
        let mut names = self
            .enabled
            .read()
            .unwrap()
            .iter()
            .cloned()
            .collect::<Vec<_>>();
        names.sort();
        names
    }
    pub fn select(&self, names: &[String]) -> Result<()> {
        if names.len() > 64
            || names
                .iter()
                .any(|n| !self.definitions.iter().any(|d| d.name.as_ref() == n))
        {
            return Err("Ferramenta não está no catálogo permitido deste MCP.".into());
        }
        *self.enabled.write().unwrap() = names.iter().cloned().collect();
        Ok(())
    }
    pub fn catalog(&self) -> Value {
        let enabled = self.enabled.read().unwrap();
        json!(self.definitions.iter().map(|d|json!({"name":d.name,"enabled":enabled.contains(d.name.as_ref()),"description":d.description.as_deref().unwrap_or("").chars().take(160).collect::<String>()})).collect::<Vec<_>>())
    }
}
struct McpTool {
    connection: Arc<Connection>,
    name: String,
}
#[async_trait]
impl ToolHandler for McpTool {
    async fn call(
        &self,
        invocation: ToolInvocation,
    ) -> std::result::Result<ToolResult, github_copilot_sdk::Error> {
        if !self.connection.connected()
            || !self.connection.enabled.read().unwrap().contains(&self.name)
        {
            return Ok(ToolResult::Text(json!({"error":"MCP is paused, disabled or disconnected; do not claim successful execution."}).to_string()));
        }
        if invocation.arguments.to_string().len() > 128 * 1024 {
            return Ok(ToolResult::Text(
                "MCP arguments exceed 128 KiB; narrow request.".into(),
            ));
        }
        let request = CallToolRequestParams::new(self.name.clone()).with_arguments(
            invocation
                .arguments
                .as_object()
                .cloned()
                .unwrap_or_default(),
        );
        let result = tokio::time::timeout(
            self.connection.timeout,
            self.connection.client.lock().await.call_tool(request),
        )
        .await;
        let value = match result {
            Ok(Ok(result)) => {
                serde_json::to_value(result).unwrap_or(json!({"error":"MCP response was not JSON"}))
            }
            Ok(Err(_)) => {
                json!({"error":"MCP call failed. Check connection/authentication/server; no successful result.","notEvidence":true})
            }
            Err(_) => {
                json!({"error":"MCP call timed out. The server may still be processing; do not blindly retry mutations.","notEvidence":true})
            }
        };
        let text = value.to_string();
        let text = if text.len() > 24000 {
            json!({"truncated":true,"content":text.chars().take(20000).collect::<String>(),"warning":"Partial MCP result. Request narrower data; do not assume omitted content is absent."}).to_string()
        } else {
            text
        };
        Ok(ToolResult::Text(text))
    }
}
pub async fn connect(name: &str, original: &Value) -> Result<Arc<Connection>> {
    let config = chat_mcp::config(original)?;
    let timeout = Duration::from_millis(config["timeout"].as_u64().unwrap_or(15000));
    let initialize = async {
        let client = if config["type"] == "stdio" {
            let mut command = stdio_command(config["command"].as_str().unwrap())?;
            command.args(
                config["args"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter_map(Value::as_str),
            );
            for key in [
                "COPILOT_GITHUB_TOKEN",
                "GH_TOKEN",
                "GITHUB_TOKEN",
                "COPILOT_SDK_AUTH_TOKEN",
            ] {
                command.env_remove(key);
            }
            if let Some(cwd) = config["cwd"].as_str() {
                command.current_dir(cwd);
            }
            if let Some(env) = config["env"].as_object() {
                for (k, v) in env {
                    command.env(k, v.as_str().unwrap());
                }
            }
            #[cfg(windows)]
            command.creation_flags(0x08000000);
            let mut wrapped = process_wrap::tokio::CommandWrap::from(command);
            #[cfg(windows)]
            wrapped
                .wrap(process_wrap::tokio::CreationFlags(
                    windows::Win32::System::Threading::CREATE_NO_WINDOW,
                ))
                .wrap(process_wrap::tokio::JobObject)
                .wrap(process_wrap::tokio::KillOnDrop);
            let transport = crate::mcp_transport::Stdio::spawn(wrapped).map_err(|_| {
                "Não foi possível iniciar MCP; confira comando/args/cwd.".to_string()
            })?;
            ().serve(transport).await.map_err(|_|"MCP não completou initialize. Confira protocolo stdio, executável e argumentos.".to_string())?
        } else if config["type"] == "http" {
            let client = reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(10))
                .build()
                .map_err(|_| "Cliente HTTP indisponível.".to_string())?;
            let mut transport = StreamableHttpClientTransportConfig::with_uri(
                config["url"].as_str().unwrap().to_owned(),
            );
            transport.max_sse_event_size = 1024 * 1024;
            transport.max_concurrent_requests = 2;
            if let Some(headers) = config["headers"].as_object() {
                for (k, v) in headers {
                    transport.custom_headers.insert(
                        k.parse()
                            .map_err(|_| "Nome de header inválido.".to_string())?,
                        v.as_str()
                            .unwrap()
                            .parse()
                            .map_err(|_| "Valor de header inválido.".to_string())?,
                    );
                }
            }
            ().serve(StreamableHttpClientTransport::with_client(crate::mcp_transport::Http(client),transport)).await.map_err(|_|"MCP HTTP não conectou: confira endpoint Streamable HTTP, autenticação, limite de 1 MiB ou política. OAuth interativo/redirect não são automáticos.".to_string())?
        } else {
            return Err("SSE legado não suportado nesta ponte. Use o endpoint MCP Streamable HTTP (type: http).".into());
        };
        let mut definitions = Vec::new();
        let mut cursor = None;
        let mut seen = std::collections::HashSet::new();
        for _ in 0..8 {
            let mut params = PaginatedRequestParams::default();
            params.cursor = cursor;
            let page = client
                .list_tools(Some(params))
                .await
                .map_err(|_| "MCP não disponibilizou tools/list.".to_string())?;
            for tool in page.tools {
                if config["tools"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|t| t == "*" || t.as_str() == Some(tool.name.as_ref()))
                {
                    if tool.name.len() > 128
                        || tool.description.as_deref().unwrap_or("").len() > 4096
                        || serde_json::to_string(&tool.input_schema)
                            .unwrap_or_default()
                            .len()
                            > 16384
                    {
                        return Err("MCP tem descrição/schema excessivo. Restrinja tools ou ajuste o servidor.".into());
                    }
                    if !seen.insert(tool.name.to_string()) {
                        return Err("MCP retornou nomes de ferramentas duplicados.".into());
                    }
                    definitions.push(tool);
                }
            }
            if definitions.len() > 64 {
                return Err("Até 64 ferramentas MCP; restrinja tools no JSON.".into());
            }
            cursor = page.next_cursor;
            if cursor.is_none() {
                break;
            }
        }
        if cursor.is_some() {
            return Err("Catálogo MCP excede 8 páginas. Restrinja o servidor.".into());
        }
        Ok(Arc::new(Connection {
            client: Mutex::new(client),
            enabled: std::sync::RwLock::new(
                definitions.iter().map(|d| d.name.to_string()).collect(),
            ),
            definitions,
            server: name.into(),
            live: AtomicBool::new(true),
            timeout,
        }))
    };
    tokio::time::timeout(Duration::from_secs(30), initialize)
        .await
        .map_err(|_| "MCP demorou a conectar; processo/conexão cancelados.".to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncBufReadExt, BufReader};
    #[test]
    fn windows_npx_shim_resolves_without_shell_interpolation() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("node_modules/npm/bin")).unwrap();
        for path in [
            "npx.cmd",
            "node.exe",
            "node_modules/npm/bin/npx-cli.js",
            "other.cmd",
        ] {
            std::fs::write(tmp.path().join(path), "fixture only").unwrap();
        }
        let mut command = stdio_command(tmp.path().join("npx.cmd").to_str().unwrap()).unwrap();
        command.arg("argument&literal|%TEST%");
        assert_eq!(command.as_std().get_program(), tmp.path().join("node.exe"));
        let args: Vec<_> = command.as_std().get_args().collect();
        assert_eq!(args[1], "argument&literal|%TEST%");
        assert!(stdio_command(tmp.path().join("other.cmd").to_str().unwrap()).is_err());
    }
    #[tokio::test]
    async fn real_streamable_http_fixture_connect_call_and_close() {
        let tmp = tempfile::tempdir().unwrap();
        let script = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("scripts/fixtures/mcp-test-server.mjs");
        let mut command =
            tokio::process::Command::new(crate::terminal::find_exe("node.exe").unwrap());
        command
            .args([
                script.to_string_lossy().as_ref(),
                tmp.path().join("audit.txt").to_string_lossy().as_ref(),
                "http",
                "--http",
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        #[cfg(windows)]
        command.creation_flags(0x08000000);
        let mut server = command.spawn().unwrap();
        let mut url = String::new();
        tokio::time::timeout(
            Duration::from_secs(10),
            BufReader::new(server.stdout.take().unwrap()).read_line(&mut url),
        )
        .await
        .unwrap()
        .unwrap();
        let connection = connect(
            "speedcode_http",
            &json!({"type":"http","url":url.trim(),"tools":["fixture_echo"]}),
        )
        .await
        .unwrap();
        assert!(connection.connected());
        assert_eq!(connection.tools().len(), 1);
        connection.select(&[]).unwrap();
        assert!(connection.tools().is_empty());
        assert_eq!(connection.catalog()[0]["enabled"], false);
        assert!(connection.select(&["unknown-tool".into()]).is_err());
        connection.select(&["fixture_echo".into()]).unwrap();
        assert_eq!(connection.tools().len(), 1);
        let value = connection
            .client
            .lock()
            .await
            .call_tool(CallToolRequestParams::new("fixture_echo"))
            .await
            .unwrap();
        assert!(
            serde_json::to_string(&value)
                .unwrap()
                .contains("MCP_VERIFIED_HTTP")
        );
        connection.close().await;
        assert!(!connection.connected());
        server.kill().await.unwrap();
        let _ = server.wait().await;
    }
    #[tokio::test]
    async fn managed_mcp_large_stdio_http_json_and_sse_fail_without_retry() {
        for label in ["oversized-stdio", "oversized-json", "oversized-sse"] {
            let tmp = tempfile::tempdir().unwrap();
            let script = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("scripts/fixtures/mcp-test-server.mjs");
            let audit = tmp.path().join("audit.txt");
            let node = crate::terminal::find_exe("node.exe").unwrap();
            let mut server = None;
            let config = if label == "oversized-stdio" {
                json!({"command":node,"args":[script,audit,label],"tools":["fixture_echo"]})
            } else {
                let mut command = tokio::process::Command::new(&node);
                command
                    .args([
                        script.to_str().unwrap(),
                        audit.to_str().unwrap(),
                        label,
                        "--http",
                    ])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::null())
                    .kill_on_drop(true);
                #[cfg(windows)]
                command.creation_flags(0x08000000);
                let mut child = command.spawn().unwrap();
                let mut url = String::new();
                tokio::time::timeout(
                    Duration::from_secs(10),
                    BufReader::new(child.stdout.take().unwrap()).read_line(&mut url),
                )
                .await
                .unwrap()
                .unwrap();
                server = Some(child);
                json!({"type":"http","url":url.trim(),"tools":["fixture_echo"]})
            };
            let connection = connect("speedcode_limit", &config).await.unwrap();
            let result = tokio::time::timeout(Duration::from_secs(10), async {
                connection
                    .client
                    .lock()
                    .await
                    .call_tool(CallToolRequestParams::new("fixture_echo"))
                    .await
            })
            .await
            .expect("oversized response must terminate, not hang");
            assert!(result.is_err(), "{label}: oversized response accepted");
            connection.close().await;
            let calls = std::fs::read_to_string(&audit).unwrap();
            assert_eq!(calls.lines().count(), 1, "{label}: mutation retried");
            if let Some(mut child) = server {
                child.kill().await.unwrap();
                let _ = child.wait().await;
            }
        }
    }
}
