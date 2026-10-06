//! Ephemeral MCP configuration validation. Secrets never returned to the WebView.
use crate::backend::Result;
use serde_json::{Value, json};
use url::Url;
pub fn name(value: &Value) -> Result<String> {
    let s = value.as_str().ok_or("Informe o nome do MCP.")?;
    if s.is_empty()
        || s.len() > 48
        || !s
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("Nome MCP: até 48 letras/números, hífen ou underscore.".into());
    }
    Ok(format!("speedcode_{s}"))
}
fn resolve(value: &str) -> Result<String> {
    let Some(var) = value
        .strip_prefix("${env:")
        .and_then(|v| v.strip_suffix('}'))
    else {
        return Err("Use ${env:NOME} em env/headers; não cole tokens ou senhas.".into());
    };
    if var.is_empty() || !var.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("Referência de ambiente inválida.".into());
    }
    std::env::var(var).map_err(|_| {
        format!("Variável {var} não está disponível ao SpeedCode. Defina e reinicie a ferramenta.")
    })
}
pub fn config(value: &Value) -> Result<Value> {
    if value.to_string().len() > 16 * 1024 {
        return Err("Configuração MCP excede 16 KiB.".into());
    }
    let source = value
        .as_object()
        .ok_or("Configuração MCP deve ser objeto JSON.")?;
    let kind =
        source
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or(if source.contains_key("url") {
                "http"
            } else {
                "stdio"
            });
    let kind = if kind == "local" { "stdio" } else { kind };
    let mut out = serde_json::Map::new();
    out.insert("type".into(), json!(kind));
    for key in source.keys() {
        if ![
            "type", "command", "args", "cwd", "env", "url", "headers", "tools", "timeout",
        ]
        .contains(&key.as_str())
        {
            return Err(format!(
                "Campo MCP não suportado: {key}. Não importamos auth/configurações globais."
            ));
        }
    }
    let default_tools = json!(["*"]);
    let tools = source
        .get("tools")
        .unwrap_or(&default_tools)
        .as_array()
        .ok_or("tools deve ser uma lista de ferramentas permitidas.")?;
    if tools.len() > 64
        || tools
            .iter()
            .any(|v| v.as_str().is_none_or(|s| s.is_empty() || s.len() > 128))
    {
        return Err("Lista de ferramentas MCP inválida.".into());
    }
    out.insert("tools".into(), json!(tools));
    out.insert(
        "timeout".into(),
        json!(
            source
                .get("timeout")
                .and_then(Value::as_u64)
                .unwrap_or(15000)
                .clamp(1000, 30000)
        ),
    );
    match kind {
        "stdio" => {
            let command = source
                .get("command")
                .and_then(Value::as_str)
                .filter(|s| !s.trim().is_empty() && s.len() < 1024)
                .ok_or("Informe o executável MCP em command.")?;
            out.insert("command".into(), json!(command));
            let args = source.get("args").cloned().unwrap_or(json!([]));
            if args.as_array().is_none_or(|v| {
                v.len() > 64 || v.iter().any(|a| a.as_str().is_none_or(|s| s.len() > 2048))
            }) {
                return Err("args deve ser uma lista de strings (até 64).".into());
            }
            out.insert("args".into(), args);
            if let Some(cwd) = source.get("cwd") {
                if cwd.as_str().is_none_or(|s| s.len() > 1024) {
                    return Err("cwd inválido.".into());
                }
                out.insert("cwd".into(), cwd.clone());
            }
        }
        "http" | "sse" => {
            let raw = source
                .get("url")
                .and_then(Value::as_str)
                .ok_or("Informe a URL MCP.")?;
            let url = Url::parse(raw).map_err(|_| "URL MCP inválida.".to_string())?;
            let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
            if (url.scheme() != "https" && !(url.scheme() == "http" && local))
                || !url.username().is_empty()
                || url.password().is_some()
                || url.query().is_some()
                || url.fragment().is_some()
            {
                return Err(
                    "MCP remoto requer HTTPS, ou HTTP localhost, sem credenciais/query na URL."
                        .into(),
                );
            }
            out.insert("url".into(), json!(raw));
        }
        _ => return Err("Transporte MCP: stdio, http ou sse.".into()),
    }
    for field in ["env", "headers"] {
        if let Some(values) = source.get(field) {
            if (field == "env" && kind != "stdio") || (field == "headers" && kind == "stdio") {
                return Err("env é para stdio; headers é para HTTP/SSE.".into());
            }
            let values = values
                .as_object()
                .ok_or("env/headers devem ser objetos com referências de ambiente.")?;
            if values.len() > 32 {
                return Err("Até 32 referências env/headers.".into());
            }
            let mut resolved = serde_json::Map::new();
            for (key, value) in values {
                if key.len() > 128
                    || !key
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
                {
                    return Err("Nome env/header inválido.".into());
                }
                resolved.insert(
                    key.clone(),
                    json!(resolve(
                        value.as_str().ok_or("Referência env/header inválida.")?
                    )?),
                );
            }
            out.insert(field.into(), json!(resolved));
        }
    }
    Ok(json!(out))
}
// Validate the ENTIRE import before any process/server is started.
pub fn entries(params: &Value) -> Result<Vec<(String, Value)>> {
    let source = &params["config"];
    if source.to_string().len() > 128 * 1024 {
        return Err("JSON MCP excede 128 KiB.".into());
    }
    let map = source.get("mcpServers").or_else(|| source.get("servers"));
    let mut result = Vec::new();
    if let Some(map) = map {
        let map = map
            .as_object()
            .ok_or("mcpServers/servers deve ser objeto com nomes e configurações.")?;
        if map.is_empty() || map.len() > 8 {
            return Err("Importe de 1 a 8 MCPs por vez.".into());
        }
        for (key, value) in map {
            let key = name(&json!(key))?;
            config(value)?;
            result.push((key, value.clone()));
        }
    } else {
        let key = name(&params["name"])?;
        config(source)?;
        result.push((key, source.clone()));
    }
    Ok(result)
}
pub fn public_servers(value: &Value) -> Value {
    json!(value["servers"].as_array().into_iter().flatten().map(|server| json!({
        "name":server["name"],"status":server["status"],"temporary":server["name"].as_str().is_some_and(|s| s.starts_with("speedcode_")),
    })).collect::<Vec<_>>())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mcp_requires_opt_in_sane_configuration_and_env_references() {
        assert_eq!(name(&json!("meu-agente")).unwrap(), "speedcode_meu-agente");
        assert!(name(&json!("../evil")).is_err());
        assert!(config(&json!({"type":"stdio","command":"agent.exe","tools":["*"]})).is_ok());
        assert!(config(&json!({"type":"http","url":"https://example.com/mcp","tools":[]})).is_ok());
        assert!(
            config(&json!({"type":"http","url":"http://example.com/mcp","tools":["*"]})).is_err()
        );
        assert!(
            config(
                &json!({"type":"http","url":"https://example.com/mcp?token=secret","tools":["*"]})
            )
            .is_err()
        );
        assert!(
            config(&json!({"command":"agent.exe","tools":["*"],"env":{"TOKEN":"literal-secret"}}))
                .is_err()
        );
        assert_eq!(
            config(&json!({"command":"agent.exe"})).unwrap()["tools"],
            json!(["*"])
        );
    }
    #[test]
    fn accepts_multiple_common_json_formats_without_starting_anything() {
        for field in ["mcpServers", "servers"] {
            let p = json!({"config":{field:{"one":{"command":"one.exe"},"two":{"url":"https://example.com/mcp"}}}});
            let imported = entries(&p).unwrap();
            assert_eq!(imported.len(), 2);
            assert_eq!(imported[0].0, "speedcode_one");
        }
        assert!(entries(&json!({"config":{"mcpServers":{"safe":{"command":"ok.exe"},"invalid":{"command":""}}}})).is_err());
        assert!(entries(&json!({"config":{"mcpServers":{}}})).is_err());
    }
    #[test]
    fn status_projection_does_not_leak_config_or_headers() {
        let value = public_servers(
            &json!({"host":{"token":"secret"},"servers":[{"name":"speedcode_example","status":"connected","config":{"env":{"TOKEN":"secret"}},"headers":{"Authorization":"secret"}}]}),
        );
        assert!(!value.to_string().contains("secret"));
        assert_eq!(value[0]["temporary"], true);
    }
}
