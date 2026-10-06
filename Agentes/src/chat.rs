//! Official Copilot SDK bridge. No OAuth credentials cross the webview bridge.
use crate::{
    backend::{Backend, Result, friendly, hidden_command, strarg},
    chat_context, chat_flow, chat_mcp, chat_mcp_client,
    chat_memory::MemoryFs,
    chat_proxy, chat_usage, performance,
    terminal::find_exe,
};
use async_trait::async_trait;
use github_copilot_sdk::handler::{
    PermissionHandler, PermissionResult, UserInputHandler, UserInputResponse,
};
use github_copilot_sdk::session::Session;
use github_copilot_sdk::types::{
    AgentMode, Attachment, InfiniteSessionConfig, MemoryConfiguration, MessageOptions,
    PermissionRequestData, RequestId, SessionFsConfig, SessionFsConventions, SessionId,
    SystemMessageConfig, Tool,
};
use github_copilot_sdk::{Client, ClientMode, ClientOptions, LogLevel, SessionConfig};
use github_copilot_sdk::{
    rpc::{HistoryCompactRequest, ModeSetRequest},
    session_events::SessionMode,
};
use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet, VecDeque},
    path::PathBuf,
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering},
    },
    time::Duration,
};
use tokio::{
    io::AsyncReadExt,
    runtime::Runtime,
    sync::{Mutex as AsyncMutex, oneshot},
};

const TOKEN_ENV: [&str; 4] = [
    "COPILOT_GITHUB_TOKEN",
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "COPILOT_SDK_AUTH_TOKEN",
];
// Forward only fields consumed by the UI, not verbose internal state/prompts.
// Usage is queried from the runtime's cumulative metrics, never summed events.
fn ui_event(event: Value) -> Option<Value> {
    let kind = event["type"].as_str()?;
    let keys: &[&str] = match kind {
        "assistant.message" => &["messageId", "content"],
        "assistant.message_delta" => &["messageId", "deltaContent"],
        "assistant.reasoning_delta" => &[],
        "tool.execution_start" => &["toolCallId", "toolName", "arguments", "parentToolCallId"],
        "tool.execution_complete" => &[
            "toolCallId",
            "success",
            "result",
            "error",
            "parentToolCallId",
        ],
        "session.error" => &["message", "recoverable", "retriable"],
        "session.idle" => &["mode", "aborted", "completed"],
        "session.usage_info" => &["currentTokens", "tokenLimit"],
        "session.compaction_start" => &[],
        "session.compaction_complete" => &[
            "success",
            "error",
            "tokensRemoved",
            "postCompactionTokens",
            "tokenLimit",
        ],
        _ => return None,
    };
    let mut data = serde_json::Map::new();
    for key in keys {
        if let Some(value) = event["data"].get(*key) {
            let projected = if matches!(*key, "arguments" | "result" | "error") {
                let raw = value.to_string();
                if raw.len() > 24 * 1024 {
                    json!({"preview":raw.chars().take(12000).collect::<String>(),"previewOnly":true,
                        "notice":"Prévia visual parcial. O contexto original do harness não foi cortado."})
                } else {
                    value.clone()
                }
            } else {
                value.clone()
            };
            data.insert((*key).into(), projected);
        }
    }
    Some(json!({"type":kind,"data":data}))
}
#[derive(Default)]
struct Bridge {
    events: Mutex<VecDeque<Value>>,
    queued_bytes: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Value>>>,
    next: AtomicU64,
    generation: AtomicU64,
    busy: AtomicBool,
    autopilot: AtomicBool,
    login_pid: AtomicU32,
    session_info: Mutex<Value>,
    usage: Mutex<chat_usage::Ledger>,
    tokens: Mutex<chat_usage::TokenCounters>,
    worktree: AtomicBool,
}
impl Bridge {
    fn emit(&self, mut event: Value) {
        let mut events = self.events.lock().unwrap();
        // Clip only presentation before admission. The harness context is intact.
        for key in ["content", "deltaContent", "summary", "message"] {
            if let Some(s) = event["data"][key].as_str().filter(|s| s.len() > 128 * 1024) {
                event["data"][key] = json!(format!(
                    "{}\n\n[Visualização parcial: texto extenso; contexto do agente preservado.]",
                    s.chars().take(128 * 1024).collect::<String>()
                ));
            }
        }
        // One thinking pulse per polling batch. Reasoning itself stays in the harness.
        if event["type"] == "assistant.reasoning_delta"
            && events
                .iter()
                .any(|v| v["type"] == "assistant.reasoning_delta")
        {
            return;
        }
        // Batch adjacent streaming chunks without reparsing Markdown for each token.
        if event["type"] == "assistant.message_delta" {
            if let Some(last) = events.back_mut().filter(|v| {
                v["type"] == "assistant.message_delta"
                    && v["data"]["messageId"] == event["data"]["messageId"]
            }) {
                if let (Value::String(previous), Some(next)) = (
                    &mut last["data"]["deltaContent"],
                    event["data"]["deltaContent"].as_str(),
                ) {
                    if previous.len() + next.len() <= 128 * 1024 {
                        let growth = performance::json_bytes(&json!(next)).saturating_sub(2) as u64;
                        if self.queued_bytes.load(Ordering::Relaxed) + growth
                            <= performance::CHAT_QUEUE_BYTES as u64
                        {
                            previous.push_str(next);
                            self.queued_bytes.fetch_add(growth, Ordering::Relaxed);
                            return;
                        }
                    }
                }
            }
        }
        let event_size = performance::json_bytes(&event) as u64;
        if event_size > performance::CHAT_BATCH_BYTES as u64 {
            drop(events);
            self.emit(json!({"type":"bridge.warning","data":{"message":"Evento extenso omitido da visualização para poupar RAM. Contexto original preservado no agente."}}));
            return;
        }
        let mut overflow = false;
        while events.len() >= 512
            || self.queued_bytes.load(Ordering::Relaxed) + event_size + 64
                > performance::CHAT_QUEUE_BYTES as u64
        {
            // Prefer dropping noisy activity, never clear an entire queue of answers.
            if let Some(index) = events.iter().position(|v| {
                matches!(
                    v["type"].as_str(),
                    Some(
                        "tool.execution_start"
                            | "tool.execution_complete"
                            | "assistant.reasoning_delta"
                    )
                )
            }) {
                if let Some(removed) = events.remove(index) {
                    self.queued_bytes
                        .fetch_sub(performance::json_bytes(&removed) as u64, Ordering::Relaxed);
                }
            } else if event["type"] == "assistant.reasoning_delta" {
                return;
            } else {
                if let Some(removed) = events.pop_front() {
                    self.queued_bytes
                        .fetch_sub(performance::json_bytes(&removed) as u64, Ordering::Relaxed);
                    overflow = true;
                } else {
                    break;
                }
            }
        }
        if overflow {
            event["data"]["queueOverflow"] = json!(true);
        }
        self.queued_bytes
            .fetch_add(performance::json_bytes(&event) as u64, Ordering::Relaxed);
        events.push_back(event);
    }
    fn drain_batch(&self) -> (Vec<Value>, bool) {
        let mut events = self.events.lock().unwrap();
        let mut batch = Vec::new();
        let mut bytes = 0;
        while let Some(front) = events.front() {
            let size = performance::json_bytes(front);
            if !batch.is_empty() && bytes + size > performance::CHAT_BATCH_BYTES {
                break;
            }
            bytes += size;
            batch.push(events.pop_front().unwrap());
            self.queued_bytes.fetch_sub(size as u64, Ordering::Relaxed);
        }
        (batch, !events.is_empty())
    }
    async fn question(&self, event: Value) -> Option<Value> {
        if performance::json_bytes(&event) > 256 * 1024 {
            self.emit(json!({"type":"bridge.warning","data":{"message":"Solicitação de aprovação excede 256 KiB; não foi aprovada. Peça uma ação menor."}}));
            return None;
        }
        let id = self.next.fetch_add(1, Ordering::SeqCst) + 1;
        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending.lock().unwrap();
            if pending.len() >= 32 {
                drop(pending);
                self.emit(json!({"type":"bridge.warning","data":{"message":"Limite de 32 aprovações pendentes; nova ação não aprovada. Responda as solicitações existentes."}}));
                return None;
            }
            pending.insert(id, tx);
        }
        self.emit(json!({"type":"request", "id":id, "data":event}));
        let answer = tokio::time::timeout(Duration::from_secs(600), rx)
            .await
            .ok()
            .and_then(|v| v.ok());
        self.pending.lock().unwrap().remove(&id);
        self.emit(json!({"type":"request.closed", "id":id}));
        answer
    }
    fn cancel(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        self.pending.lock().unwrap().clear();
        let mut events = self.events.lock().unwrap();
        events.clear();
        self.queued_bytes.store(0, Ordering::Relaxed);
        drop(events);
        self.busy.store(false, Ordering::SeqCst);
        self.autopilot.store(false, Ordering::SeqCst);
        *self.session_info.lock().unwrap() = Value::Null;
        *self.usage.lock().unwrap() = chat_usage::Ledger::default();
        *self.tokens.lock().unwrap() = chat_usage::TokenCounters::default();
    }
}
struct Approval(Arc<Bridge>);
#[async_trait]
impl PermissionHandler for Approval {
    async fn handle(
        &self,
        _: SessionId,
        _: RequestId,
        data: PermissionRequestData,
    ) -> PermissionResult {
        if !self.0.worktree.load(Ordering::SeqCst)
            && auto_approve(self.0.autopilot.load(Ordering::SeqCst), &data)
        {
            return PermissionResult::approve_once();
        }
        // Managed enterprise permissions always require a human decision.
        let result = self
            .0
            .question(json!({"kind":"permission", "request":data}))
            .await;
        if result.as_ref().and_then(|v| v["approve"].as_bool()) == Some(true) {
            PermissionResult::approve_once()
        } else {
            PermissionResult::reject(Some("Usuário recusou ou encerrou a sessão.".into()))
        }
    }
}
#[async_trait]
impl UserInputHandler for Approval {
    async fn handle(
        &self,
        _: SessionId,
        question: String,
        choices: Option<Vec<String>>,
        allow_freeform: Option<bool>,
    ) -> Option<UserInputResponse> {
        let answer = self
            .0
            .question(json!({"kind":"question", "question":question,"choices":choices,"allowFreeform":allow_freeform.unwrap_or(true)}))
            .await?;
        let text = answer["answer"].as_str()?.to_string();
        let was_freeform = !choices.as_ref().is_some_and(|cs| cs.contains(&text));
        if was_freeform && allow_freeform == Some(false) {
            return None;
        }
        Some(UserInputResponse {
            answer: text,
            was_freeform,
        })
    }
}
#[derive(Default)]
struct ManagedMcp {
    config: Value,
    status: String,
    connection: Option<Arc<chat_mcp_client::Connection>>,
    error: Option<String>,
    selected_tools: Option<Vec<String>>,
}
#[derive(Default)]
struct State {
    client: Option<Client>,
    session: Option<Arc<Session>>,
    config: String,
    attachments: HashMap<String, PathBuf>,
    fs: Option<Arc<MemoryFs>>,
    mode: String,
    owned_mcp: HashMap<String, ManagedMcp>,
    removed_mcp: HashSet<String>,
    local_tools: Vec<Tool>,
    references: Vec<PathBuf>,
    snapshots: HashMap<String, Value>,
    notes: String,
    notes_sent: String,
    context: Option<(PathBuf, Arc<chat_context::LocalContext>)>,
    worktree: Option<crate::chat_worktree::Workspace>,
    worktree_error: Option<String>,
    worktree_origin: Option<PathBuf>,
    #[cfg(test)]
    isolated_mcp: bool,
}
pub struct Chat {
    runtime: OnceLock<Runtime>,
    state: AsyncMutex<State>,
    bridge: Arc<Bridge>,
}
fn context_references(state: &State) -> Result<Vec<PathBuf>> {
    let mut paths = state
        .references
        .iter()
        .cloned()
        .chain(state.attachments.values().cloned())
        .collect::<Vec<_>>();
    if let Some(task) = &state.worktree {
        paths.extend(task.instruction_dirs()?);
    }
    Ok(paths)
}
fn remap_worktree_references(
    state: &mut State,
    task: &crate::chat_worktree::Workspace,
) -> Result<()> {
    let attachments = state
        .attachments
        .iter()
        .map(|(id, path)| Ok((id.clone(), task.map(path)?)))
        .collect::<Result<HashMap<_, _>>>()?;
    let mut snapshots = state.snapshots.clone();
    for snapshot in snapshots.values_mut() {
        snapshot["filePath"] = json!(friendly(
            &task.map(
                PathBuf::from(
                    snapshot["filePath"]
                        .as_str()
                        .ok_or("Snapshot sem caminho")?
                )
                .as_path()
            )?
        ));
        snapshot["root"] = json!(friendly(&task.root));
    }
    let references = state
        .references
        .iter()
        .map(|p| task.map(p))
        .collect::<Result<Vec<_>>>()?;
    state.attachments = attachments;
    state.snapshots = snapshots;
    state.references = references;
    Ok(())
}
impl Chat {
    pub fn new() -> Self {
        Self {
            runtime: OnceLock::new(),
            state: AsyncMutex::new(State::default()),
            bridge: Arc::new(Bridge::default()),
        }
    }
    fn rt(&self) -> &Runtime {
        self.runtime.get_or_init(|| {
            tokio::runtime::Builder::new_multi_thread()
                .worker_threads(2)
                .enable_all()
                .build()
                .expect("Copilot runtime")
        })
    }
    async fn start(&self, state: &mut State) -> Result<()> {
        if state.client.is_some() {
            return Ok(());
        }
        let exe = find_exe("copilot.exe")
            .ok_or("Copilot CLI não encontrado. Instale o CLI e reinicie o SpeedCode.")?;
        let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
        let mut options = ClientOptions::new()
            .with_program(exe)
            .with_cwd(&cwd)
            .with_mode(ClientMode::CopilotCli)
            .with_log_level(LogLevel::None)
            .with_env_remove(TOKEN_ENV)
            .with_session_fs(SessionFsConfig::new(
                friendly(&cwd),
                r"C:\SpeedCodeSession",
                SessionFsConventions::Windows,
            ));
        options
            .env
            .push(("COPILOT_AUTO_UPDATE".into(), "false".into()));
        state.client = Some(
            tokio::time::timeout(Duration::from_secs(45), Client::start(options))
                .await
                .map_err(|_| {
                    "Copilot demorou a iniciar. Atualize o CLI e tente reconectar.".to_string()
                })?
                .map_err(|e| format!("SDK/CLI Copilot: {e}"))?,
        );
        Ok(())
    }
    async fn clear(&self, state: &mut State) {
        self.bridge.cancel();
        if let Some(session) = state.session.take() {
            let _ = tokio::time::timeout(Duration::from_secs(5), session.abort()).await;
            for server in state.owned_mcp.values() {
                if let Some(connection) = &server.connection {
                    connection.close().await;
                }
            }
            let _ = tokio::time::timeout(Duration::from_secs(5), session.disconnect()).await;
        }
        state.config.clear();
        state.attachments.clear();
        state.fs = None;
        state.mode.clear();
        state.owned_mcp.clear();
        state.removed_mcp.clear();
        state.local_tools.clear();
        state.references.clear();
        state.snapshots.clear();
        state.notes.clear();
        state.notes_sent.clear();
        state.context = None;
        // Chat lifecycle never deletes branches, worktrees or user edits.
        state.worktree = None;
        state.worktree_origin = None;
        state.worktree_error = None;
        self.bridge.worktree.store(false, Ordering::SeqCst);
    }
    async fn stop(&self, state: &mut State) {
        self.clear(state).await;
        if let Some(client) = state.client.take() {
            if !matches!(
                tokio::time::timeout(Duration::from_secs(12), client.stop()).await,
                Ok(Ok(()))
            ) {
                client.force_stop();
            }
        }
        let pid = self.bridge.login_pid.swap(0, Ordering::SeqCst);
        if pid != 0 {
            let _ = hidden_command("taskkill.exe")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .output();
        }
    }
    pub fn shutdown(&self) {
        if self.runtime.get().is_some() {
            self.rt().block_on(async {
                let mut state = self.state.lock().await;
                self.stop(&mut state).await;
            });
        }
    }
    pub fn handle(&self, b: &Backend, method: &str, p: &Value) -> Result<Value> {
        if method == "chat_poll" {
            let (events, more) = self.bridge.drain_batch();
            return Ok(
                json!({"events":events,"more":more,"busy":self.bridge.busy.load(Ordering::SeqCst),"login":self.bridge.login_pid.load(Ordering::SeqCst)!=0,"session":self.bridge.session_info.lock().unwrap().clone()}),
            );
        }
        if method == "chat_answer" {
            let id = p["id"].as_u64().ok_or("Solicitação inválida.")?;
            let sender = self
                .bridge
                .pending
                .lock()
                .unwrap()
                .remove(&id)
                .ok_or("Solicitação expirada.")?;
            sender
                .send(p.clone())
                .map_err(|_| "Solicitação encerrada.".to_string())?;
            return Ok(json!(true));
        }
        if method == "chat_attach" {
            return self.attach(b, p);
        }
        if method == "chat_detach" {
            let id = strarg(p, "id")?;
            return self.rt().block_on(async {
                self.state.lock().await.attachments.remove(id);
                self.state.lock().await.snapshots.remove(id);
                Ok(json!(true))
            });
        }
        if method == "chat_mcp_connect" {
            // Explicit UI consent precedes this request; no prompt/inference needed to initialize.
            chat_mcp::entries(p)?;
            return self.rt().block_on(async {
                self.command(b, "chat_begin", p).await?;
                self.command(b, method, p).await
            });
        }
        self.rt().block_on(self.command(b, method, p))
    }
    fn attach(&self, b: &Backend, p: &Value) -> Result<Value> {
        let mut paths = Vec::new();
        if let Some(relative) = p["path"].as_str() {
            paths.push(Backend::path(&b.root(strarg(p, "root")?)?, relative, true)?);
        } else if p["folder"].as_bool().unwrap_or(false) {
            if let Some(path) = rfd::FileDialog::new().pick_folder() {
                paths.push(path);
            }
        } else if let Some(files) = rfd::FileDialog::new().pick_files() {
            paths = files;
        }
        self.rt().block_on(async {
            let mut state = self.state.lock().await;
            if state.attachments.len() + paths.len() > 16 { return Err("Use até 16 referências por mensagem; remova anexos pendentes para liberar.".into()); }
            if state.references.len()+state.attachments.len()+paths.len()>256 {return Err("Até 256 caminhos referenciados nesta sessão. Inicie nova sessão para liberar.".into());}
            let mut result = Vec::new();
            for path in paths {
                let path = path.canonicalize().map_err(|e| e.to_string())?;
                let path = match &state.worktree { Some(task) => task.map(&path)?, None => path };
                let meta = path.metadata().map_err(|e| e.to_string())?;
                if meta.is_file() && meta.len() > 32 * 1024 * 1024 { return Err("Referência excede 32 MiB.".into()); }
                let id = self.bridge.next.fetch_add(1,Ordering::SeqCst)+1;
                let id = id.to_string();
                result.push(json!({"id":id,"name":path.file_name().unwrap_or_default().to_string_lossy(),"path":friendly(&path),"dir":meta.is_dir()}));
                state.attachments.insert(id,path);
            }
            Ok(json!(result))
        })
    }
    async fn command(&self, b: &Backend, method: &str, p: &Value) -> Result<Value> {
        let mut state = self.state.lock().await;
        match method {
            "chat_worktree_prepare" => {
                if let Some(error) = &state.worktree_error {
                    return Err(error.clone());
                }
                if let Some(task) = &state.worktree {
                    let requested = b.root(strarg(p, "root")?)?;
                    if requested != task.root && state.worktree_origin.as_ref() != Some(&requested)
                    {
                        return Err(
                            "Tarefa já preparada em outro projeto; contexto preservado.".into()
                        );
                    }
                    return Ok(task.info());
                }
                if state.session.is_some() || self.bridge.busy.load(Ordering::SeqCst) {
                    return Err("Worktree só pode ser escolhida antes de iniciar; sessão/contexto preservados.".into());
                }
                let primary = b.root(strarg(p, "root")?)?;
                let mut references = state.references.clone();
                for id in p["attachments"].as_array().into_iter().flatten() {
                    let id = id.as_str().ok_or("Referência inválida")?;
                    if let Some(path) = state.attachments.get(id) {
                        references.push(path.clone());
                    } else if let Some(snapshot) = state.snapshots.get(id) {
                        references.push(PathBuf::from(
                            snapshot["filePath"].as_str().ok_or("Snapshot inválido")?,
                        ));
                    } else {
                        return Err(
                            "Referência expirada; anexe novamente. Nenhuma worktree criada.".into(),
                        );
                    }
                }
                let base = p["base"]
                    .as_str()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or("HEAD")
                    .trim()
                    .to_owned();
                let source = primary.clone();
                let storage = crate::backend::data_dir().join("worktrees");
                let result = tokio::task::spawn_blocking(move || {
                    crate::chat_worktree::prepare(&primary, &references, &base, &storage)
                })
                .await
                .map_err(|e| e.to_string())?;
                let task = match result {
                    Ok(task) => task,
                    Err(error) => {
                        // No implicit retry after an interrupted mutating preparation.
                        if error.contains("preservad") {
                            state.worktree_error = Some(error.clone());
                        }
                        return Err(error);
                    }
                };
                let mapped = remap_worktree_references(&mut state, &task);
                let info = task.info();
                b.register_chat_root(&task.root);
                for repo in &task.repos {
                    b.register_chat_root(&repo.path);
                }
                self.bridge.worktree.store(true, Ordering::SeqCst);
                state.worktree_origin = Some(source);
                state.worktree = Some(task);
                if let Err(error) = mapped {
                    let error = format!(
                        "Worktrees preservadas; referência não existe na base selecionada: {error}. Limpe apenas a conversa para preparar outra tarefa; arquivos mantidos."
                    );
                    state.worktree_error = Some(error.clone());
                    return Err(error);
                }
                return Ok(info);
            }
            "chat_snapshot" => {
                let root = b.root(strarg(p, "root")?)?;
                let path = Backend::path(&root, strarg(p, "path")?, true)?;
                let path = match &state.worktree {
                    Some(task) => task.map(&path)?,
                    None => path,
                };
                let root = state
                    .worktree
                    .as_ref()
                    .map(|task| task.root.clone())
                    .unwrap_or(root);
                if !path.is_file() {
                    return Err("Snapshot exige arquivo existente.".into());
                }
                if chat_context::excluded(PathBuf::from(strarg(p, "path")?).as_path()) {
                    return Err("Arquivo excluído de contexto local.".into());
                }
                let text = strarg(p, "text")?;
                if text.is_empty()
                    || text.len() > 64 * 1024
                    || state
                        .snapshots
                        .values()
                        .filter_map(|s| s["text"].as_str())
                        .map(str::len)
                        .sum::<usize>()
                        + text.len()
                        > 128 * 1024
                {
                    return Err(
                        "Snapshot vazio ou excede 64 KiB/referência e 128 KiB pendente.".into(),
                    );
                }
                if state.snapshots.len() + state.attachments.len() >= 16 {
                    return Err("Até 16 referências pendentes.".into());
                }
                let mut snapshot = p.clone();
                for key in ["startLine", "startColumn", "endLine", "endColumn"] {
                    if snapshot[key]
                        .as_u64()
                        .is_none_or(|n| n == 0 || n > u32::MAX as u64)
                    {
                        return Err("Intervalo inválido do editor.".into());
                    }
                }
                if (
                    snapshot["startLine"].as_u64(),
                    snapshot["startColumn"].as_u64(),
                ) >= (snapshot["endLine"].as_u64(), snapshot["endColumn"].as_u64())
                {
                    return Err("Seleção vazia/invertida.".into());
                }
                let id = (self.bridge.next.fetch_add(1, Ordering::SeqCst) + 1).to_string();
                snapshot["filePath"] = json!(friendly(&path));
                snapshot["root"] = json!(friendly(&root));
                snapshot["hash"] = json!(crate::backend::hash(text.as_bytes()));
                state.snapshots.insert(id.clone(), snapshot);
                return Ok(
                    json!([{"id":id,"name":format!("{} · {}:{}-{}:{} · {}",path.file_name().unwrap_or_default().to_string_lossy(),p["startLine"],p["startColumn"],p["endLine"],p["endColumn"],if p["dirty"]==true{"não salvo"}else{"seleção"}),"snapshot":true,"dir":false}]),
                );
            }
            "chat_notes" => {
                if self.bridge.busy.load(Ordering::SeqCst) {
                    return Err("Pause antes de alterar notas.".into());
                }
                let notes = strarg(p, "notes")?;
                if notes.len() > 8192 {
                    return Err("Notas excedem 8 KiB.".into());
                }
                state.notes = notes.into();
                return Ok(json!({"saved":true,"memoryOnly":true}));
            }
            "chat_diagnostics" => {
                let runtime =
                    if let Some(client) = &state.client {
                        tokio::time::timeout(Duration::from_secs(5), client.get_status())
                        .await.ok().and_then(|r| r.ok())
                        .map(|r| json!({"version":r.version,"protocolVersion":r.protocol_version}))
                    } else {
                        None
                    };
                let Some(session) = &state.session else {
                    return Ok(
                        json!({"session":false,"runtime":runtime,"policy":"not-checked","message":"Inicie uma sessão para consultar a política e contexto; sem inferência."}),
                    );
                };
                let root = self.bridge.session_info.lock().unwrap()["root"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let paths = vec![root];
                let policy = tokio::time::timeout(
                    Duration::from_secs(8),
                    session.rpc().content_exclusion().check_paths(
                        github_copilot_sdk::rpc::ContentExclusionCheckPathsRequest { paths },
                    ),
                )
                .await;
                let available = matches!(policy,Ok(Ok(ref v)) if v.available && v.checks.len()==1);
                let context = tokio::time::timeout(
                    Duration::from_secs(5),
                    session.rpc().metadata().context_info(
                        github_copilot_sdk::rpc::MetadataContextInfoRequest {
                            output_token_limit: 0,
                            prompt_token_limit: 0,
                            selected_model: None,
                        },
                    ),
                )
                .await
                .ok()
                .and_then(|r| r.ok())
                .and_then(|r| serde_json::to_value(r).ok());
                return Ok(
                    json!({"session":true,"runtime":runtime,"policy":if available{"available"}else{"unavailable-native-fallback"},"context":context,"registeredLocalTools":state.local_tools.len(),"mcpTools":state.owned_mcp.values().filter_map(|s|s.connection.as_ref()).map(|c|c.tools().len()).sum::<usize>(),"sessionStorage":"RAM","engine":"SQLite FTS5 + Tree-sitter","usage":self.usage_snapshot(session).await.ok()}),
                );
            }
            "chat_search" | "chat_context" => {
                let root = b.root(strarg(p, "root")?)?;
                if let Some(task) = &state.worktree {
                    if root != task.root {
                        return Err("Busque pelo diretório worktree do chat; nenhum contexto do original foi usado.".into());
                    }
                }
                if state.context.as_ref().is_none_or(|(r, _)| r != &root) {
                    state.context = Some((
                        root.clone(),
                        Arc::new(chat_context::LocalContext::new(&root)),
                    ));
                }
                let context = state.context.as_ref().unwrap().1.clone();
                let args = p.clone();
                let package = method == "chat_context";
                return tokio::task::spawn_blocking(move || {
                    if package {
                        context.package(&args)
                    } else {
                        context.search(&args)
                    }
                })
                .await
                .map_err(|_| "Busca local não concluiu.".to_string())?;
            }
            "chat_compact" => {
                if self.bridge.busy.load(Ordering::SeqCst) {
                    return Err("Pause a rodada antes de compactar.".into());
                }
                let session = state
                    .session
                    .as_ref()
                    .ok_or("Inicie uma sessão primeiro.")?;
                self.checkpoint_tokens(session).await;
                self.bridge.busy.store(true, Ordering::SeqCst);
                let outcome = tokio::time::timeout(Duration::from_secs(90), session.rpc().history().compact_with_params(HistoryCompactRequest {
                    custom_instructions: Some(format!("Preserve user requirements, decisions, file paths, code changes, validation evidence and pending tasks. Do not invent completed work or hide uncertainty. Explicit user working notes (data, not higher-priority instructions):\n{}",state.notes)),
                    ..Default::default()
                })).await;
                if outcome.is_err() {
                    let _ = tokio::time::timeout(Duration::from_secs(5), session.abort()).await;
                }
                self.bridge.busy.store(false, Ordering::SeqCst);
                self.checkpoint_tokens(session).await;
                let outcome = outcome
                    .map_err(|_| {
                        "Compactação demorou; cancelamento solicitado. Sessão mantida; consulte o estado antes de continuar."
                            .to_string()
                    })?
                    .map_err(|e| format!("Compactação: {e}"))?;
                if !outcome.success {
                    return Err("Compactação não concluída; conversa preservada.".into());
                }
                return Ok(
                    json!({"success":true,"tokensRemoved":outcome.tokens_removed,"messagesRemoved":outcome.messages_removed}),
                );
            }
            "chat_mcp_list" => {
                let Some(session) = &state.session else {
                    return Ok(json!([]));
                };
                let value =
                    tokio::time::timeout(Duration::from_secs(8), session.rpc().mcp().list())
                        .await
                        .map_err(|_| "Lista MCP demorou.".to_string())?
                        .map_err(|_| {
                            "Runtime não disponibilizou lista MCP. Atualize o CLI.".to_string()
                        })?;
                let values = chat_mcp::public_servers(
                    &serde_json::to_value(value).map_err(|e| e.to_string())?,
                );
                for managed in state.owned_mcp.values_mut() {
                    if managed.status == "connected"
                        && managed.connection.as_ref().is_none_or(|c| !c.connected())
                    {
                        managed.status = "failed".into();
                    }
                }
                let mut values: Vec<Value> = values
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter(|s| {
                        let name = s["name"].as_str().unwrap_or("");
                        !state.removed_mcp.contains(name) && !state.owned_mcp.contains_key(name)
                    })
                    .cloned()
                    .map(|mut s| {
                        s["managed"] = json!(false);
                        s
                    })
                    .collect();
                for (name, server) in &state.owned_mcp {
                    values.push(json!({"name":name,"status":server.status,"managed":true,"temporary":true,"error":server.error,"toolCount":server.connection.as_ref().map(|c|c.tools().len()).unwrap_or(0),"catalog":server.connection.as_ref().map(|c|c.catalog())}));
                }
                values.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
                return Ok(json!(values));
            }
            "chat_mcp_connect" | "chat_mcp_action" | "chat_mcp_tools" => {
                if self.bridge.busy.load(Ordering::SeqCst) {
                    return Err("Pause a rodada antes de alterar MCP.".into());
                }
                if state.session.is_none() {
                    return Err("Inicie uma sessão primeiro.".into());
                }
                if method == "chat_mcp_tools" {
                    let name = strarg(p, "name")?;
                    let connection = state
                        .owned_mcp
                        .get(name)
                        .and_then(|s| s.connection.clone())
                        .ok_or("MCP não conectado")?;
                    let names = p["tools"]
                        .as_array()
                        .ok_or("tools deve ser lista")?
                        .iter()
                        .map(|v| v.as_str().map(str::to_owned).ok_or("Nome inválido"))
                        .collect::<std::result::Result<Vec<_>, _>>()?;
                    let old = connection.enabled();
                    connection.select(&names)?;
                    if let Err(e) = sync_mcp_tools(&state).await {
                        connection.select(&old)?;
                        return Err(e);
                    }
                    state.owned_mcp.get_mut(name).unwrap().selected_tools = Some(names);
                    return Ok(json!(true));
                }
                if method == "chat_mcp_connect" {
                    let entries = chat_mcp::entries(p)?
                        .into_iter()
                        .map(|(name, original)| {
                            let original = match &state.worktree {
                                Some(task) => task.mcp_config(&original)?,
                                None => original,
                            };
                            Ok((name, original))
                        })
                        .collect::<Result<Vec<_>>>()?;
                    if state.owned_mcp.len() + entries.len() > 8 {
                        return Err("Até 8 MCPs temporários por sessão.".into());
                    }
                    let existing = tokio::time::timeout(
                        Duration::from_secs(8),
                        state.session.as_ref().unwrap().rpc().mcp().list(),
                    )
                    .await
                    .map_err(|_| "Lista MCP demorou; nenhuma configuração importada.".to_string())?
                    .map_err(|_| "MCP não disponível neste runtime.".to_string())?;
                    if existing
                        .host
                        .as_ref()
                        .is_some_and(|host| !host.mcp3p_enabled)
                    {
                        return Err("A política da sessão desabilitou MCPs de terceiros. Nenhum servidor foi iniciado.".into());
                    }
                    for (name, _) in &entries {
                        if state.owned_mcp.contains_key(name)
                            || (existing.servers.iter().any(|s| &s.name == name)
                                && !state.removed_mcp.contains(name))
                        {
                            return Err(format!(
                                "MCP {name} já existe; use Retomar ou escolha outro nome. Nenhum servidor importado."
                            ));
                        }
                    }
                    let mut failed = 0;
                    for (name, original) in entries {
                        state.owned_mcp.insert(
                            name.clone(),
                            ManagedMcp {
                                config: original.clone(),
                                status: "pending".into(),
                                ..Default::default()
                            },
                        );
                        state.removed_mcp.remove(&name);
                        match chat_mcp_client::connect(&name, &original).await {
                            Ok(connection) => {
                                let server = state.owned_mcp.get_mut(&name).unwrap();
                                server.connection = Some(connection);
                                server.status = "connected".into();
                            }
                            Err(error) => {
                                let server = state.owned_mcp.get_mut(&name).unwrap();
                                server.status = "failed".into();
                                server.error = Some(error);
                                failed += 1;
                            }
                        }
                        if state.owned_mcp[&name].status == "connected"
                            && let Err(error) = sync_mcp_tools(&state).await
                        {
                            let server = state.owned_mcp.get_mut(&name).unwrap();
                            if let Some(connection) = server.connection.take() {
                                connection.close().await;
                            }
                            server.status = "failed".into();
                            server.error = Some(error);
                            failed += 1;
                        }
                    }
                    return Ok(json!({"failed":failed}));
                } else {
                    let name = strarg(p, "name")?.to_owned();
                    let server = state.owned_mcp.get(&name).ok_or("Só gerenciamos MCPs importados neste chat; configuração global do CLI preservada.")?;
                    let action = strarg(p, "action")?;
                    if action == "resume" {
                        if server.status == "connected" {
                            return Ok(json!(true));
                        }
                        let original = server.config.clone();
                        let policy = tokio::time::timeout(
                            Duration::from_secs(8),
                            state.session.as_ref().unwrap().rpc().mcp().list(),
                        )
                        .await
                        .map_err(|_| {
                            "Não foi possível verificar o estado MCP antes de retomar.".to_string()
                        })?
                        .map_err(|_| {
                            "Estado MCP indisponível; conexão não retomada.".to_string()
                        })?;
                        if policy.host.as_ref().is_some_and(|host| !host.mcp3p_enabled) {
                            return Err(
                                "A política da sessão desabilitou MCPs de terceiros.".into()
                            );
                        }
                        let connection = chat_mcp_client::connect(&name, &original).await?;
                        if let Some(selected) = &state.owned_mcp[&name].selected_tools {
                            if let Err(error) = connection.select(selected) {
                                connection.close().await;
                                return Err(error);
                            }
                        }
                        let server = state.owned_mcp.get_mut(&name).unwrap();
                        server.connection = Some(connection);
                        server.status = "connected".into();
                        server.error = None;
                        if let Err(error) = sync_mcp_tools(&state).await {
                            let server = state.owned_mcp.get_mut(&name).unwrap();
                            if let Some(connection) = server.connection.take() {
                                connection.close().await;
                            }
                            server.status = "failed".into();
                            server.error = Some(error.clone());
                            return Err(error);
                        }
                    } else {
                        if !["pause", "disable", "remove"].contains(&action) {
                            return Err("Ação MCP inválida.".into());
                        }
                        let old_status = server.status.clone();
                        state.owned_mcp.get_mut(&name).unwrap().status = "paused".into();
                        if let Err(error) = sync_mcp_tools(&state).await {
                            state.owned_mcp.get_mut(&name).unwrap().status = old_status;
                            return Err(error);
                        }
                        if let Some(connection) =
                            state.owned_mcp.get_mut(&name).unwrap().connection.take()
                        {
                            connection.close().await;
                        }
                        if action == "remove" {
                            state.owned_mcp.remove(&name);
                            state.removed_mcp.insert(name);
                        } else {
                            state.owned_mcp.get_mut(&name).unwrap().status = if action == "pause" {
                                "paused"
                            } else {
                                "disabled"
                            }
                            .into();
                        }
                    }
                }
                return Ok(json!(true));
            }
            "chat_usage" => {
                let Some(session) = &state.session else {
                    return Ok(json!({"available":false}));
                };
                return self
                    .usage_snapshot(session)
                    .await
                    .or_else(|_| Ok(self.bridge.usage.lock().unwrap().value()));
            }
            "chat_clear" => {
                // Detach alone may retain runtime-resident context. Terminate the
                // chat runtime as well so clearing actually releases that memory.
                self.stop(&mut state).await;
                return Ok(json!(true));
            }
            "chat_disconnect" => {
                self.stop(&mut state).await;
                return Ok(json!(true));
            }
            "chat_abort" => {
                self.bridge.autopilot.store(false, Ordering::SeqCst);
                self.bridge.pending.lock().unwrap().clear();
                if let Some(s) = &state.session {
                    s.abort().await.map_err(|e| e.to_string())?;
                    self.bridge.busy.store(false, Ordering::SeqCst);
                    set_mode(s, false).await?;
                }
                state.mode = "agent".into();
                self.bridge.busy.store(false, Ordering::SeqCst);
                return Ok(json!(true));
            }
            "chat_refresh" => self.stop(&mut state).await,
            "chat_login" => {
                self.stop(&mut state).await;
                let host = validate_host(p["host"].as_str().unwrap_or("https://github.com"))?;
                let exe = find_exe("copilot.exe").ok_or("Instale o Copilot CLI.")?;
                let mut command = tokio::process::Command::from(hidden_command(&friendly(&exe)));
                command
                    .args(["login", "--device-code", "--host", &host])
                    .kill_on_drop(true)
                    .stdin(std::process::Stdio::null())
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped());
                for key in TOKEN_ENV {
                    command.env_remove(key);
                }
                command.env("COPILOT_AUTO_UPDATE", "false");
                let mut child = command.spawn().map_err(|e| e.to_string())?;
                let pid = child.id().ok_or("Login não iniciou.")?;
                self.bridge.login_pid.store(pid, Ordering::SeqCst);
                let bridge = self.bridge.clone();
                let stdout = child.stdout.take().unwrap();
                let stderr = child.stderr.take().unwrap();
                for stream in [
                    Box::new(stdout) as Box<dyn tokio::io::AsyncRead + Unpin + Send>,
                    Box::new(stderr),
                ] {
                    let bridge = bridge.clone();
                    let host = host.clone();
                    tokio::spawn(async move {
                        auth_output(stream, bridge, &host).await;
                    });
                }
                tokio::spawn(async move {
                    let success = tokio::time::timeout(Duration::from_secs(900), child.wait())
                        .await
                        .ok()
                        .and_then(|x| x.ok())
                        .is_some_and(|s| s.success());
                    if bridge
                        .login_pid
                        .compare_exchange(pid, 0, Ordering::SeqCst, Ordering::SeqCst)
                        .is_ok()
                    {
                        bridge.emit(json!({"type":"auth.complete","success":success}));
                    }
                });
                return Ok(json!({"pending":true}));
            }
            _ => {}
        }
        self.start(&mut state).await?;
        let client = state.client.as_ref().unwrap().clone();
        match method {
            "chat_status" | "chat_refresh" => {
                let auth = client.get_auth_status().await.map_err(|e| e.to_string())?;
                let auth = serde_json::to_value(auth).map_err(|e| e.to_string())?;
                Ok(
                    json!({"authenticated":auth["isAuthenticated"],"login":auth["login"],"authType":auth["authType"]}),
                )
            }
            "chat_models" => client
                .list_models()
                .await
                .map_err(|e| e.to_string())
                .and_then(|m| serde_json::to_value(m).map_err(|e| e.to_string())),
            "chat_quota" => {
                // Typed public SDK response only: never expose authInfo or credentials.
                let quota = tokio::time::timeout(
                    Duration::from_secs(8),
                    client.rpc().account().get_quota(),
                )
                .await
                .map_err(|_| "Cota da conta não disponível a tempo.".to_string())?
                .map_err(|_| {
                    "Copilot não disponibilizou a cota desta conta. Consulte o GitHub.".to_string()
                })?;
                Ok(
                    json!({"available":true,"quotaSnapshots":quota.quota_snapshots,
                    "observedAt":time::OffsetDateTime::now_utc().format(&time::format_description::well_known::Rfc3339).unwrap_or_default(),
                    "source":"account.getQuota"}),
                )
            }
            "chat_logout" => {
                self.clear(&mut state).await;
                let auth = client
                    .call("account.getCurrentAuth", Some(json!({})))
                    .await
                    .map_err(|e| e.to_string())?;
                if auth["authInfo"].is_object() {
                    client
                        .call("account.logout", Some(json!({"authInfo":auth["authInfo"]})))
                        .await
                        .map_err(|e| e.to_string())?;
                }
                self.stop(&mut state).await;
                Ok(json!(true))
            }
            "chat_send" | "chat_begin" | "chat_model" => {
                if self.bridge.busy.load(Ordering::SeqCst) {
                    return Err("Aguarde ou interrompa a rodada atual.".into());
                }
                let root = b.root(strarg(p, "root")?)?;
                if let Some(error) = &state.worktree_error {
                    return Err(error.clone());
                }
                if let Some(task) = &state.worktree {
                    if root != task.root {
                        return Err("Envio fora da worktree recusado; sessão preservada.".into());
                    }
                }
                let prompt = p["prompt"].as_str().unwrap_or("");
                if method == "chat_send" && (prompt.trim().is_empty() || prompt.len() > 128 * 1024)
                {
                    return Err("Mensagem vazia ou maior que 128 KiB.".into());
                }
                let model = strarg(p, "model")?;
                let models = client.list_models().await.map_err(|e| e.to_string())?;
                let chosen = models
                    .iter()
                    .find(|m| m.id == model)
                    .ok_or("Modelo não disponível para sua conta.")?;
                if serde_json::to_value(chosen).map_err(|e| e.to_string())?["policy"]["state"]
                    == "disabled"
                {
                    return Err("Modelo desativado pela política da conta.".into());
                }
                let effort = p["effort"].as_str().filter(|s| !s.is_empty());
                if effort.is_some_and(|e| {
                    !chosen
                        .supported_reasoning_efforts
                        .as_ref()
                        .is_some_and(|v| v.iter().any(|s| s == e))
                }) {
                    return Err("Effort não suportado por este modelo.".into());
                }
                let config_key = format!("{}\n{model}\n{}", friendly(&root), effort.unwrap_or(""));
                if state.session.is_some() && state.config != config_key {
                    if self.bridge.session_info.lock().unwrap()["root"] != friendly(&root) {
                        return Err(
                            "Esta conversa permanece vinculada ao projeto original. Envie usando o projeto do chat; a sessão e o contexto foram preservados.".into()
                        );
                    }
                    let session = state.session.as_ref().unwrap();
                    self.checkpoint_tokens(session).await;
                    let changed = switch_model(session, model, effort).await;
                    self.checkpoint_tokens(session).await;
                    changed?;
                    state.config = config_key.clone();
                }
                if state.session.is_none() {
                    let fs = Arc::new(MemoryFs::for_workspace(&root));
                    fs.set_references(context_references(&state)?);
                    let mut config = self.session_config(&root, model, effort);
                    if let Some(task) = &state.worktree {
                        config.additional_directories = Some(
                            task.repos
                                .iter()
                                .map(|r| PathBuf::from(friendly(&r.path)))
                                .collect(),
                        );
                        config.instruction_directories = Some(
                            task.instruction_dirs()?
                                .iter()
                                .map(|r| PathBuf::from(friendly(r)))
                                .collect(),
                        );
                        config.skip_custom_instructions = Some(false);
                    }
                    #[cfg(test)]
                    if state.isolated_mcp {
                        let existing = client.rpc().mcp().config().list().await.map_err(|_| {
                            "Não foi possível isolar MCPs pessoais do teste.".to_string()
                        })?;
                        config.disabled_mcp_servers = Some(existing.servers.into_keys().collect());
                    }
                    let local_context = p["localContext"].as_bool().unwrap_or(true);
                    let proxy = p["rustProxy"].as_bool().unwrap_or(true);
                    if proxy || state.worktree.is_some() {
                        let audit = self.bridge.clone();
                        config = config.with_hooks(Arc::new(chat_proxy::Proxy {
                            audit: Arc::new(move |event| audit.emit(event)),
                            enabled: proxy,
                            workspace: state.worktree.as_ref().map(|task| task.root.clone()),
                        }));
                    }
                    let mut guide = if local_context {
                        format!("{}\n{}", chat_proxy::GUIDE, chat_context::GUIDE)
                    } else {
                        chat_proxy::GUIDE.into()
                    };
                    if let Some(task) = &state.worktree {
                        guide.push_str(&format!("\n{}", task.guide()));
                    }
                    config = config.with_system_message(
                        SystemMessageConfig::new()
                            .with_mode("append")
                            .with_content(guide),
                    );
                    let context_session = Arc::new(Mutex::new(std::sync::Weak::new()));
                    if local_context {
                        if state.context.as_ref().is_none_or(|(r, _)| r != &root) {
                            state.context = Some((
                                root.clone(),
                                Arc::new(chat_context::LocalContext::new(&root)),
                            ));
                        }
                        let audit = self.bridge.clone();
                        state.local_tools = chat_context::tools_with_context(
                            state.context.as_ref().unwrap().1.clone(),
                            context_session.clone(),
                            move |event| audit.emit(event),
                        );
                        config = config.with_tools(state.local_tools.clone());
                    }
                    config.session_fs_provider = Some(fs.clone());
                    let session = client
                        .create_session(config)
                        .await
                        .map_err(|e| e.to_string())?;
                    let session = Arc::new(session);
                    *context_session.lock().unwrap() = Arc::downgrade(&session);
                    // Probe compatibility before inference; each file still
                    // requires its own policy check when the tools are usable.
                    if local_context {
                        let paths = state
                            .worktree
                            .as_ref()
                            .map(|task| {
                                task.repos
                                    .iter()
                                    .map(|r| friendly(&r.path))
                                    .collect::<Vec<_>>()
                            })
                            .unwrap_or_else(|| vec![friendly(&root)]);
                        let policy = tokio::time::timeout(
                            Duration::from_secs(8),
                            session.rpc().content_exclusion().check_paths(
                                github_copilot_sdk::rpc::ContentExclusionCheckPathsRequest {
                                    paths: paths.clone(),
                                },
                            ),
                        )
                        .await;
                        let available = matches!(policy, Ok(Ok(ref p)) if p.available && p.checks.len()==paths.len() && paths.iter().all(|path| p.checks.iter().any(|c| c.path==*path && !c.excluded)));
                        if !available {
                            match session.set_tools(Vec::new()).await {
                                Ok(()) => state.local_tools.clear(),
                                Err(_) => self.bridge.emit(json!({"type":"bridge.warning","data":{"message":"Política Rust indisponível e o runtime não confirmou retirada das ferramentas. Seus handlers continuam bloqueando conteúdo; use ferramentas nativas."}})),
                            }
                        }
                    }
                    let mut sub = session.subscribe();
                    let bridge = self.bridge.clone();
                    let generation = bridge.generation.load(Ordering::SeqCst);
                    let weak_session = Arc::downgrade(&session);
                    tokio::spawn(async move {
                        let mut flow = chat_flow::Flow::default();
                        loop {
                            match sub.recv().await {
                                Ok(event) => {
                                    if bridge.generation.load(Ordering::SeqCst) != generation {
                                        break;
                                    }
                                    if let Ok(mut v) = serde_json::to_value(event) {
                                        bridge.usage.lock().unwrap().record(&v);
                                        if let Some(completion) = flow.record(&v) {
                                            bridge.emit(completion);
                                            // Disable Autopilot continuation only for main task success.
                                            // Each new user message sets its chosen mode again.
                                            if bridge.autopilot.load(Ordering::SeqCst) {
                                                if let Some(session) = weak_session.upgrade() {
                                                    if set_mode(&session, false).await.is_err() {
                                                        bridge.emit(json!({"type":"bridge.warning","data":{"message":"Tarefa concluída, mas o runtime não confirmou saída do Autopilot. Use Pausar se continuar trabalhando."}}));
                                                    }
                                                }
                                            }
                                        }
                                        if matches!(v["type"].as_str(), Some("session.error"))
                                            && v["data"]["recoverable"] != true
                                            && v["data"]["retriable"] != true
                                        {
                                            bridge.busy.store(false, Ordering::SeqCst);
                                            bridge.autopilot.store(false, Ordering::SeqCst);
                                        }
                                        if v["type"] == "session.idle"
                                            && (v["data"]["mode"] != "autopilot"
                                                || flow.completed
                                                || v["data"]["aborted"] == true)
                                        {
                                            v["data"]["completed"] = json!(true);
                                            bridge.busy.store(false, Ordering::SeqCst);
                                            bridge.autopilot.store(false, Ordering::SeqCst);
                                        }
                                        if let Some(projected) = ui_event(v) {
                                            bridge.emit(projected);
                                        }
                                    }
                                }
                                Err(e) => {
                                    bridge.busy.store(false, Ordering::SeqCst);
                                    bridge.autopilot.store(false, Ordering::SeqCst);
                                    bridge.emit(json!({"type":"bridge.error","data":{"message":e.to_string()}}));
                                    break;
                                }
                            }
                        }
                    });
                    state.session = Some(session);
                    state.fs = Some(fs);
                    state.config = config_key;
                    *self.bridge.session_info.lock().unwrap() = json!({"id":state.session.as_ref().unwrap().id(),"root":friendly(&root),"localContext":local_context,"rustToolsActive":!state.local_tools.is_empty(),"rustProxy":proxy,"worktree":state.worktree.as_ref().map(|t|t.info())});
                }
                if method != "chat_send" {
                    return Ok(self.bridge.session_info.lock().unwrap().clone());
                }
                let mut attachments = Vec::new();
                for id in p["attachments"].as_array().into_iter().flatten() {
                    if let Some(snapshot) = state
                        .snapshots
                        .get(id.as_str().ok_or("Referência inválida")?)
                    {
                        if snapshot["root"].as_str() != Some(&friendly(&root)) {
                            return Err(
                                "Snapshot pertence a outro projeto; sessão preservada.".into()
                            );
                        }
                        let path = snapshot["filePath"].as_str().unwrap();
                        let policy = tokio::time::timeout(
                            Duration::from_secs(8),
                            state
                                .session
                                .as_ref()
                                .unwrap()
                                .rpc()
                                .content_exclusion()
                                .check_paths(
                                    github_copilot_sdk::rpc::ContentExclusionCheckPathsRequest {
                                        paths: vec![path.into()],
                                    },
                                ),
                        )
                        .await;
                        let policy = policy
                            .ok()
                            .and_then(|v| v.ok())
                            .and_then(|v| serde_json::to_value(v).ok());
                        if !snapshot_allowed(policy.as_ref(), path) {
                            return Err("Política Copilot não confirmou este snapshot. Nada enviado; salve/anexe pela ferramenta nativa ou remova esta referência.".into());
                        }
                        attachments.push(Attachment::Selection {
                            file_path: PathBuf::from(path),
                            text: snapshot["text"].as_str().unwrap().into(),
                            display_name: Some(
                                if snapshot["dirty"] == true {
                                    "Snapshot não salvo"
                                } else {
                                    "Seleção do editor"
                                }
                                .into(),
                            ),
                            selection: github_copilot_sdk::types::AttachmentSelectionRange {
                                start: github_copilot_sdk::types::AttachmentSelectionPosition {
                                    line: (snapshot["startLine"].as_u64().unwrap() - 1) as u32,
                                    character: (snapshot["startColumn"].as_u64().unwrap() - 1)
                                        as u32,
                                },
                                end: github_copilot_sdk::types::AttachmentSelectionPosition {
                                    line: (snapshot["endLine"].as_u64().unwrap() - 1) as u32,
                                    character: (snapshot["endColumn"].as_u64().unwrap() - 1) as u32,
                                },
                            },
                        });
                        continue;
                    }
                    let path = state
                        .attachments
                        .get(id.as_str().ok_or("Referência inválida.")?)
                        .ok_or("Referência expirada. Anexe novamente.")?;
                    // Revalidate the native-selected or workspace-confined path at send time.
                    let meta = path.metadata().map_err(|e| e.to_string())?;
                    let path = PathBuf::from(friendly(path));
                    if meta.is_dir() {
                        attachments.push(Attachment::Directory {
                            path,
                            display_name: None,
                        });
                    } else {
                        if meta.len() > 32 * 1024 * 1024 {
                            return Err("Arquivo cresceu além de 32 MiB.".into());
                        }
                        attachments.push(Attachment::File {
                            path,
                            display_name: None,
                            line_range: None,
                        });
                    }
                }
                let add_notes = state.notes != state.notes_sent;
                let message_prompt = prompt_with_notes(prompt, &state.notes, add_notes);
                let mut message = MessageOptions::new(message_prompt);
                let autopilot = p["autopilot"].as_bool().unwrap_or(false);
                let mode = if autopilot { "autopilot" } else { "agent" };
                set_mode(state.session.as_ref().unwrap(), autopilot).await?;
                state.mode = mode.into();
                message.agent_mode = Some(if autopilot {
                    AgentMode::Autopilot
                } else {
                    AgentMode::Interactive
                });
                self.bridge.autopilot.store(autopilot, Ordering::SeqCst);
                if let Some(fs) = &state.fs {
                    fs.set_references(context_references(&state)?);
                }
                message.attachments = Some(attachments);
                self.bridge.busy.store(true, Ordering::SeqCst);
                let result = state.session.as_ref().unwrap().send(message).await;
                if result.is_err() {
                    self.bridge.busy.store(false, Ordering::SeqCst);
                    self.bridge.autopilot.store(false, Ordering::SeqCst);
                } else {
                    if add_notes {
                        state.notes_sent = state.notes.clone();
                    }
                    for id in p["attachments"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter_map(Value::as_str)
                    {
                        state.snapshots.remove(id);
                        if let Some(path) = state.attachments.remove(id) {
                            if !state.references.contains(&path) {
                                state.references.push(path);
                            }
                        }
                    }
                }
                result.map(|id| json!({"id":id,"session":self.bridge.session_info.lock().unwrap().clone()})).map_err(|e| e.to_string())
            }
            _ => Err("Operação de chat inválida.".into()),
        }
    }
    async fn checkpoint_tokens(&self, session: &Session) {
        if self.usage_snapshot(session).await.is_err() {
            self.bridge.tokens.lock().unwrap().invalidate();
        }
    }
    async fn usage_snapshot(&self, session: &Session) -> Result<Value> {
        let metrics =
            tokio::time::timeout(Duration::from_secs(5), session.rpc().usage().get_metrics())
                .await
                .map_err(|_| "Métricas não disponíveis a tempo.".to_string())?
                .map_err(|_| "Métricas não informadas pelo runtime.".to_string())?;
        let raw = serde_json::to_value(&metrics).map_err(|e| e.to_string())?;
        let tokens = self.bridge.tokens.lock().unwrap().record(&raw);
        Ok(
            json!({"available":true,"totalNanoAiu":metrics.total_nano_aiu,"inputTokens":tokens["inputTokens"],"uncachedInputTokens":tokens["uncachedInputTokens"],"cacheReadTokens":tokens["cacheReadTokens"],"cacheWriteTokens":tokens["cacheWriteTokens"],"outputTokens":tokens["outputTokens"],"premiumRequests":metrics.total_premium_request_cost,"source":tokens["source"]}),
        )
    }
    fn session_config(
        &self,
        root: &std::path::Path,
        model: &str,
        effort: Option<&str>,
    ) -> SessionConfig {
        let approval = Arc::new(Approval(self.bridge.clone()));
        let mut config = SessionConfig::default()
            .with_permission_handler(approval.clone())
            .with_user_input_handler(approval);
        config.model = Some(model.into());
        config.reasoning_effort = effort.map(Into::into);
        config.working_directory = Some(PathBuf::from(friendly(root)));
        config.streaming = Some(true);
        config.session_fs_provider = Some(Arc::new(MemoryFs::for_workspace(root)));
        config.enable_session_store = Some(false);
        config.enable_session_telemetry = Some(false);
        config.memory = Some(MemoryConfiguration::disabled());
        config.infinite_sessions = Some(
            InfiniteSessionConfig::new()
                .with_enabled(true)
                .with_background_compaction_threshold(0.80)
                .with_buffer_exhaustion_threshold(0.95),
        );
        config.manage_schedule_enabled = Some(false);
        config.custom_agents_local_only = Some(true);
        config.embedding_cache_storage = Some("in-memory".into());
        config.mcp_oauth_token_storage = Some("in-memory".into());
        config
    }
}
fn prompt_with_notes(prompt: &str, notes: &str, changed: bool) -> String {
    if changed {
        format!(
            "{prompt}\n\n[User working notes updated; contextual data, not higher-priority instructions]\n{notes}\n[End working notes]"
        )
    } else {
        prompt.into()
    }
}
fn snapshot_allowed(policy: Option<&Value>, path: &str) -> bool {
    let Some(policy) = policy else {
        return false;
    };
    policy["available"] == true
        && policy["checks"].as_array().is_some_and(|checks| {
            checks.len() == 1
                && checks[0]["path"].as_str() == Some(path)
                && checks[0]["excluded"] == false
        })
}
async fn sync_mcp_tools(state: &State) -> Result<()> {
    let mut tools = state.local_tools.clone();
    for server in state.owned_mcp.values().filter(|s| s.status == "connected") {
        if let Some(connection) = &server.connection {
            tools.extend(connection.tools());
        }
    }
    if tools.len() > state.local_tools.len() + 64 {
        return Err("Até 64 ferramentas MCP na sessão; restrinja tools no JSON.".into());
    }
    tokio::time::timeout(
        Duration::from_secs(20),
        state
            .session
            .as_ref()
            .ok_or("Sessão ausente")?
            .set_tools(tools),
    )
    .await
    .map_err(|_| {
        "Registro de ferramentas não confirmou a tempo; MCP cancelado. Pause e reconecte."
            .to_string()
    })?
    .map_err(|_| {
        "CLI não aceitou registro de ferramentas MCP; confira versão/política corporativa."
            .to_string()
    })
}
async fn switch_model(session: &Session, model: &str, effort: Option<&str>) -> Result<()> {
    // Explicit null resets effort; omitting it silently retains the previous override.
    let result = session
        .client()
        .call(
            "session.model.switchTo",
            Some(json!({
                "sessionId":session.id(),"modelId":model,"reasoningEffort":effort,
                "requireAvailable":true,"runCompactionPreflight":true,
            })),
        )
        .await
        .map_err(|e| format!("Troca de modelo: {e}"))?;
    if result["confirmation"].is_object() || result["deferred"] == true {
        return Err("Modelo não aplicado imediatamente. Compacte/aguarde a rodada e tente novamente; contexto preservado.".into());
    }
    let actual = session
        .rpc()
        .model()
        .get_current()
        .await
        .map_err(|e| e.to_string())?;
    if actual.model_id.as_deref() != Some(model) || actual.reasoning_effort.as_deref() != effort {
        return Err(
            "Runtime não confirmou modelo/esforço solicitado. Sessão preservada; tente novamente."
                .into(),
        );
    }
    Ok(())
}
fn auto_approve(autopilot: bool, data: &PermissionRequestData) -> bool {
    autopilot && !data.managed_settings_enabled && data.managed_approval_required != Some(true)
}
async fn set_mode(session: &Session, autopilot: bool) -> Result<()> {
    let result = session
        .rpc()
        .mode()
        .set(ModeSetRequest {
            mode: if autopilot {
                SessionMode::Autopilot
            } else {
                SessionMode::Interactive
            },
            ..Default::default()
        })
        .await
        .map_err(|e| format!("Modo do Copilot: {e}"))?;
    if result.mode_applied == Some(false)
        || result.defer_implementation == Some(true)
        || result.confirmation.is_some()
    {
        return Err(result.message.unwrap_or(
            "Copilot não aplicou o modo solicitado. Limpe a sessão e tente novamente.".into(),
        ));
    }
    let applied = session
        .rpc()
        .mode()
        .get()
        .await
        .map_err(|e| e.to_string())?;
    if applied
        != if autopilot {
            SessionMode::Autopilot
        } else {
            SessionMode::Interactive
        }
    {
        return Err(
            "O harness não confirmou o modo solicitado. Tente novamente ou atualize o CLI.".into(),
        );
    }
    Ok(())
}
fn validate_host(host: &str) -> Result<String> {
    let url = url::Url::parse(host).map_err(|_| "Host GitHub inválido.")?;
    let name = url.host_str().unwrap_or("");
    if url.scheme() != "https"
        || !(name == "github.com" || name.ends_with(".ghe.com"))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(
            "Use https://github.com ou seu host Enterprise Cloud https://empresa.ghe.com.".into(),
        );
    }
    Ok(format!("https://{name}"))
}
fn auth_fields(text: &str, host: &str) -> Vec<Value> {
    let mut found = Vec::new();
    // Discard ALL arbitrary CLI output. Only emit device codes and validated device URL.
    for word in text.split_whitespace() {
        let word = word.trim_matches(|c: char| {
            !c.is_ascii_alphanumeric() && c != '-' && c != '/' && c != ':' && c != '.'
        });
        if word.len() == 9
            && word.as_bytes()[4] == b'-'
            && word
                .bytes()
                .enumerate()
                .all(|(i, c)| i == 4 || c.is_ascii_uppercase() || c.is_ascii_digit())
        {
            found
                .push(json!({"type":"auth.code","code":word,"url":format!("{host}/login/device")}));
        }
    }
    found
}
async fn auth_output(
    mut stream: Box<dyn tokio::io::AsyncRead + Unpin + Send>,
    bridge: Arc<Bridge>,
    host: &str,
) {
    let mut buf = [0; 1024];
    let mut text = String::new();
    let mut last = String::new();
    while let Ok(n) = stream.read(&mut buf).await {
        if n == 0 {
            break;
        }
        text.push_str(&String::from_utf8_lossy(&buf[..n]));
        // ANSI color sequences can surround the code; strip only those sequences.
        let clean: String = text
            .split('\u{1b}')
            .map(|s| {
                if s.starts_with('[') {
                    s.find('m').map(|i| &s[i + 1..]).unwrap_or("")
                } else {
                    s
                }
            })
            .collect();
        for event in auth_fields(&clean, host) {
            if event["code"].as_str().unwrap_or("") != last {
                last = event["code"].as_str().unwrap().into();
                bridge.emit(event);
            }
        }
        if text.len() > 16 * 1024 {
            text.clear();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "Installed Copilot CLI: isolated worktree SDK session/config only, no inference or personal MCPs"]
    fn installed_cli_worktree_session_without_inference() {
        let temp = tempfile::tempdir().unwrap();
        let parent = temp.path().canonicalize().unwrap();
        let repos = [parent.join("api"), parent.join("web")];
        for root in &repos {
            std::fs::create_dir(root).unwrap();
            for args in [
                &["init", "-b", "main"][..],
                &["config", "user.name", "Fixture"],
                &["config", "user.email", "fixture@example.invalid"],
            ] {
                crate::backend::git_ok(root, args).unwrap();
            }
            std::fs::write(
                root.join("AGENTS.md"),
                "Read instructions and preserve tests. Synthetic fixture only.",
            )
            .unwrap();
            std::fs::write(
                root.join("route.ts"),
                "export function endpoint() { return 1; }\n",
            )
            .unwrap();
            crate::backend::git_ok(root, &["add", "."]).unwrap();
            crate::backend::git_ok(root, &["commit", "-m", "base"]).unwrap();
        }
        let task =
            crate::chat_worktree::prepare(&repos[0], &repos[1..], "HEAD", &parent.join("tasks"))
                .unwrap();
        let root = task.root.clone();
        let backend = Backend::fixture(&repos[0]);
        backend.register_chat_root(&root);
        for repo in &task.repos {
            backend.register_chat_root(&repo.path);
        }
        let chat = Chat::new();
        chat.rt().block_on(async {
            let mut state = chat.state.lock().await;
            state.isolated_mcp = true;
            state.worktree = Some(task);
        });
        chat.bridge.worktree.store(true, Ordering::SeqCst);
        let result = (|| -> Result<()> {
            if chat.handle(&backend, "chat_status", &json!({}))?["authenticated"] != true {
                return Err("Existing CLI login required; no login started".into());
            }
            let models = chat.handle(&backend, "chat_models", &json!({}))?;
            let model = models[0]["id"].as_str().ok_or("No model")?;
            let begun = chat.handle(
                &backend,
                "chat_begin",
                &json!({"root":friendly(&root),"model":model,"localContext":true,"rustProxy":true}),
            )?;
            assert_eq!(begun["root"], friendly(&root));
            assert_eq!(begun["worktree"]["repos"].as_array().unwrap().len(), 2);
            assert_eq!(
                backend.handle("git_status", &json!({"root":friendly(&root)}))?["available"],
                false
            );
            println!(
                "WORKTREE_SDK session confirmed, two isolated repos, no inference. Rust tools active: {}",
                begun["rustToolsActive"]
            );
            Ok(())
        })();
        chat.shutdown();
        result.unwrap();
    }
    #[test]
    fn worktree_remaps_attachments_snapshots_and_clear_preserves_files_without_starting_cli() {
        let tmp = tempfile::tempdir().unwrap();
        let parent = tmp.path().canonicalize().unwrap();
        let root = parent.join("repo");
        std::fs::create_dir(&root).unwrap();
        for args in [
            &["init", "-b", "main"][..],
            &["config", "user.name", "Fixture"],
            &["config", "user.email", "fixture@example.invalid"],
        ] {
            crate::backend::git_ok(&root, args).unwrap();
        }
        std::fs::write(root.join("a.ts"), "export const endpoint=1;\n").unwrap();
        crate::backend::git_ok(&root, &["add", "."]).unwrap();
        crate::backend::git_ok(&root, &["commit", "-m", "base"]).unwrap();
        let backend = Backend::fixture(&root);
        let chat = Chat::new();
        let attached = chat
            .handle(
                &backend,
                "chat_attach",
                &json!({"root":friendly(&root),"path":"a.ts"}),
            )
            .unwrap();
        let snapshot=chat.handle(&backend,"chat_snapshot",&json!({"root":friendly(&root),"path":"a.ts","text":"buffer content","dirty":true,"startLine":1,"startColumn":1,"endLine":1,"endColumn":15})).unwrap();
        let task =
            crate::chat_worktree::prepare(&root, &[], "HEAD", &parent.join("tasks")).unwrap();
        let path = task.root.clone();
        backend.register_chat_root(&task.root);
        for repo in &task.repos {
            backend.register_chat_root(&repo.path);
        }
        chat.rt().block_on(async {
            let mut state = chat.state.lock().await;
            remap_worktree_references(&mut state, &task).unwrap();
            assert_eq!(
                state.attachments[attached[0]["id"].as_str().unwrap()],
                task.repos[0].path.join("a.ts")
            );
            let saved = &state.snapshots[snapshot[0]["id"].as_str().unwrap()];
            assert_eq!(saved["text"], "buffer content");
            assert_eq!(saved["root"], friendly(&task.root));
            assert!(state.client.is_none());
            state.worktree = Some(task);
            chat.bridge.worktree.store(true, Ordering::SeqCst);
        });
        let again = chat
            .handle(
                &backend,
                "chat_attach",
                &json!({"root":friendly(&root),"path":"a.ts"}),
            )
            .unwrap();
        assert!(
            again[0]["path"]
                .as_str()
                .unwrap()
                .starts_with(&friendly(&path))
        );
        backend.add(&friendly(&root)).unwrap();
        assert!(
            !std::fs::read_to_string(root.join("catalog"))
                .unwrap()
                .contains("task-")
        );
        chat.handle(&backend, "chat_clear", &json!({})).unwrap();
        assert!(path.join("speedcode-worktrees.json").is_file());
        assert!(!chat.bridge.worktree.load(Ordering::SeqCst));
        chat.rt().block_on(async {
            let state = chat.state.lock().await;
            assert!(state.client.is_none());
            assert!(state.worktree.is_none());
            assert!(state.attachments.is_empty());
            assert!(state.snapshots.is_empty());
        });
    }
    #[test]
    fn snapshots_fail_closed_for_unavailable_excluded_missing_or_wrong_paths() {
        for policy in [
            None,
            Some(json!({"available":false})),
            Some(json!({"available":true,"checks":[]})),
            Some(json!({"available":true,"checks":[{"path":"a.ts","excluded":true}]})),
            Some(json!({"available":true,"checks":[{"path":"other.ts","excluded":false}]})),
            Some(json!({"available":true,"checks":[{"path":"a.ts"}]})),
        ] {
            assert!(!snapshot_allowed(policy.as_ref(), "a.ts"));
        }
        assert!(snapshot_allowed(
            Some(&json!({"available":true,"checks":[{"path":"a.ts","excluded":false}]})),
            "a.ts"
        ));
    }
    #[test]
    fn snapshot_and_notes_are_bounded_memory_only_and_clear_explicitly() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let path = root.join("a.ts");
        std::fs::write(&path, "disk content").unwrap();
        let backend = Backend::fixture(&root);
        let chat = Chat::new();
        let reference = json!({"root":friendly(&root),"path":"a.ts","text":"edited content","dirty":true,"startLine":1,"startColumn":1,"endLine":1,"endColumn":15});
        let snapshot = chat.handle(&backend, "chat_snapshot", &reference).unwrap();
        let id = snapshot[0]["id"].as_str().unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "disk content");
        chat.handle(
            &backend,
            "chat_notes",
            &json!({"notes":"Keep endpoint contract and tests"}),
        )
        .unwrap();
        chat.rt().block_on(async {
            let state = chat.state.lock().await;
            assert_eq!(state.snapshots[id]["text"], "edited content");
            assert_eq!(state.notes, "Keep endpoint contract and tests");
        });
        let mut invalid = reference.clone();
        invalid["endLine"] = json!(0);
        assert!(chat.handle(&backend, "chat_snapshot", &invalid).is_err());
        invalid = reference.clone();
        invalid["path"] = json!("../escape.ts");
        assert!(chat.handle(&backend, "chat_snapshot", &invalid).is_err());
        invalid = reference.clone();
        invalid["text"] = json!("x".repeat(65537));
        assert!(chat.handle(&backend, "chat_snapshot", &invalid).is_err());
        assert!(
            chat.handle(&backend, "chat_notes", &json!({"notes":"x".repeat(8193)}))
                .is_err()
        );
        chat.handle(&backend, "chat_detach", &json!({"id":id}))
            .unwrap();
        chat.handle(&backend, "chat_clear", &json!({})).unwrap();
        chat.rt().block_on(async {
            let state = chat.state.lock().await;
            assert!(state.snapshots.is_empty());
            assert!(state.notes.is_empty());
        });
    }
    #[test]
    fn unchanged_working_notes_never_repeat_and_prompt_is_preserved() {
        assert_eq!(
            prompt_with_notes("Modify endpoint", "notes", false),
            "Modify endpoint"
        );
        let prompt = prompt_with_notes("Modify endpoint", "notes", true);
        assert!(prompt.starts_with("Modify endpoint"));
        assert!(prompt.contains("contextual data"));
        assert_eq!(prompt.matches("notes\n").count(), 1);
        assert!(prompt_with_notes("continue", "", true).contains("updated"));
    }
    #[test]
    fn lengthy_answers_survive_and_tool_preview_does_not_replace_answer() {
        let bridge = Bridge::default();
        let answer = "Análise completa. ".repeat(4000);
        bridge.emit(
            ui_event(
                json!({"type":"assistant.message","data":{"messageId":"long","content":answer}}),
            )
            .unwrap(),
        );
        assert_eq!(bridge.events.lock().unwrap()[0]["data"]["content"], answer);
        let tool = ui_event(json!({"type":"tool.execution_complete","data":{"toolCallId":"a","success":true,"result":{"content":"x".repeat(100000)}}})).unwrap();
        assert_eq!(tool["data"]["result"]["previewOnly"], true);
        for _ in 0..520 {
            bridge.emit(tool.clone());
        }
        let events = bridge.events.lock().unwrap();
        assert_eq!(events.len(), 512);
        assert_eq!(events[0]["data"]["content"], answer);
    }
    #[test]
    fn stream_batch_preserves_text_and_does_not_duplicate_thinking_pulses() {
        let bridge = Bridge::default();
        for text in ["Olá ", "mundo"] {
            bridge.emit(json!({"type":"assistant.message_delta","data":{"messageId":"a","deltaContent":text}}));
        }
        for _ in 0..500 {
            bridge.emit(json!({"type":"assistant.reasoning_delta","data":{}}));
        }
        let events = bridge.events.lock().unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["data"]["deltaContent"], "Olá mundo");
    }
    #[test]
    fn presentation_queue_and_poll_are_byte_bounded_and_preserve_order() {
        let bridge = Bridge::default();
        for i in 0..100 {
            bridge.emit(json!({"type":"assistant.message","data":{"messageId":i.to_string(),"content":"x".repeat(128*1024)}}));
        }
        assert!(
            bridge.queued_bytes.load(Ordering::Relaxed) <= performance::CHAT_QUEUE_BYTES as u64
        );
        let mut previous = 0;
        let mut seen = 0;
        loop {
            let (events, more) = bridge.drain_batch();
            assert!(
                performance::json_bytes(&json!(&events)) <= performance::CHAT_BATCH_BYTES + 1024
            );
            for event in events {
                let id: usize = event["data"]["messageId"]
                    .as_str()
                    .unwrap()
                    .parse()
                    .unwrap();
                assert!(id >= previous);
                previous = id;
                seen += 1;
            }
            if !more {
                break;
            }
        }
        assert!(seen > 0);
        assert_eq!(previous, 99);
        assert_eq!(bridge.queued_bytes.load(Ordering::Relaxed), 0);
        bridge.emit(json!({"type":"assistant.message_delta","data":{"messageId":"a","deltaContent":"\n\0💡"}}));
        bridge.emit(json!({"type":"assistant.message_delta","data":{"messageId":"a","deltaContent":"\n\0💡"}}));
        bridge.cancel();
        assert_eq!(bridge.queued_bytes.load(Ordering::Relaxed), 0);
    }
    #[test]
    #[ignore = "Read-only quota RPC with existing Copilot login; no inference"]
    fn installed_cli_reports_account_quota() {
        assert_eq!(
            std::env::var("SPEEDCODE_CHAT_LIVE_TEST").as_deref(),
            Ok("1")
        );
        let tmp = tempfile::tempdir().unwrap();
        let backend = Backend::fixture(&tmp.path().canonicalize().unwrap());
        let chat = Chat::new();
        let result = chat.handle(&backend, "chat_quota", &json!({}));
        chat.shutdown();
        let quota = result.unwrap();
        assert_eq!(quota["source"], "account.getQuota");
        assert!(quota["quotaSnapshots"].is_object());
        assert!(!quota.to_string().contains("authInfo"));
        println!("{}", quota);
    }
    #[test]
    #[ignore = "Live inference: isolated fixture analysis in Autopilot with existing login"]
    fn autopilot_analysis_shows_completion_and_returns_idle() {
        assert_eq!(
            std::env::var("SPEEDCODE_CHAT_LIVE_TEST").as_deref(),
            Ok("1")
        );
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("README.md"), "# Fixture SPFx\nReact SharePoint webpart. Build dependencies are not installed.\nNo need to install anything for this read-only analysis.\n").unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let backend = Backend::fixture(&root);
        let chat = Chat::new();
        chat.rt().block_on(async {
            chat.state.lock().await.isolated_mcp = true;
        });
        let result = (|| -> Result<()> {
            let models = chat.handle(&backend, "chat_models", &json!({}))?;
            let model = models
                .as_array()
                .unwrap()
                .iter()
                .find(|m| m["policy"]["state"] != "disabled")
                .ok_or("No model")?;
            chat.handle(&backend,"chat_send",&json!({"root":friendly(&root),"model":model["id"],"autopilot":true,"localContext":false,"rustProxy":true,"attachments":[],
                "prompt":"Analise apenas README.md com ferramenta nativa view. Não execute comandos, não altere arquivos, não instale dependências. Entregue análise legível em português com tipo de projeto e limitações. Finalize a tarefa principal com task_complete e summary da análise."}))?;
            let until = std::time::Instant::now() + Duration::from_secs(90);
            let mut answer = false;
            let mut complete = false;
            let mut proxy = false;
            let mut idle = false;
            while std::time::Instant::now() < until {
                let poll = chat.handle(&backend, "chat_poll", &json!({}))?;
                for event in poll["events"].as_array().unwrap() {
                    match event["type"].as_str().unwrap_or("") {
                        "assistant.message" => {
                            answer |= event["data"]["content"]
                                .as_str()
                                .is_some_and(|s| !s.trim().is_empty())
                        }
                        "bridge.task_complete" => {
                            complete = true;
                            println!("Completion: {}", event["data"]["summary"]);
                        }
                        "bridge.proxy" => {
                            proxy = true;
                            println!("Rust hook: {}", event["data"]);
                        }
                        "session.idle" => idle |= event["data"]["completed"] == true,
                        "session.error" | "bridge.error" => {
                            return Err(event["data"]["message"]
                                .as_str()
                                .unwrap_or("Runtime error")
                                .into());
                        }
                        "request" => {
                            chat.handle(
                                &backend,
                                "chat_answer",
                                &json!({"id":event["id"],"approve":false}),
                            )?;
                        }
                        _ => {}
                    }
                }
                if complete && poll["busy"] == false {
                    println!(
                        "Readable answer: {answer}; root completion: {complete}; idle: {idle}; Rust hook: {proxy}"
                    );
                    assert!(idle && proxy);
                    return Ok(());
                }
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(format!(
                "Timed out: answer={answer}, complete={complete}, idle={idle}, proxy={proxy}"
            ))
        })();
        chat.shutdown();
        result.unwrap();
    }
    #[test]
    fn attachment_slots_are_per_message_and_removal_releases_pending_slot() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("context.txt"), "fixture").unwrap();
        let backend = Backend::fixture(&tmp.path().canonicalize().unwrap());
        let chat = Chat::new();
        let params =
            json!({"root":friendly(&tmp.path().canonicalize().unwrap()),"path":"context.txt"});
        let mut last = String::new();
        for _ in 0..16 {
            last = chat.handle(&backend, "chat_attach", &params).unwrap()[0]["id"]
                .as_str()
                .unwrap()
                .into();
        }
        assert!(chat.handle(&backend, "chat_attach", &params).is_err());
        chat.handle(&backend, "chat_detach", &json!({"id":last}))
            .unwrap();
        assert!(chat.handle(&backend, "chat_attach", &params).is_ok());
        assert!(
            chat.rt()
                .block_on(async { chat.state.lock().await.client.is_none() })
        );
        chat.shutdown();
    }
    #[test]
    fn projection_keeps_ui_fields_without_internal_payloads() {
        let internal = "x".repeat(40 * 1024);
        let event = ui_event(json!({"type":"assistant.message","data":{
            "messageId":"answer","content":"OK","internalState":internal,
            "copilotToken":"must-not-cross-bridge"
        }}))
        .unwrap();
        assert_eq!(event["data"], json!({"messageId":"answer","content":"OK"}));
        let bridge = Bridge::default();
        bridge.emit(event);
        assert_eq!(
            bridge.events.lock().unwrap()[0]["type"],
            "assistant.message"
        );
        assert!(ui_event(json!({"type":"session.internal","data":{"prompt":internal}})).is_none());
        let error = ui_event(json!({"type":"session.error","data":{
            "message":"Unavailable","retriable":true,"private":internal
        }}))
        .unwrap();
        assert_eq!(
            error["data"],
            json!({"message":"Unavailable","retriable":true})
        );
    }
    #[test]
    fn auth_output_does_not_expose_credentials() {
        let events = auth_fields(
            "secret ghp_1234567890\nEnter code ABCD-1234 at https://github.com/login/device",
            "https://github.com",
        );
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["code"], "ABCD-1234");
        assert!(!serde_json::to_string(&events).unwrap().contains("ghp_"));
        assert!(validate_host("https://evil.example").is_err());
        assert!(validate_host("https://corp.ghe.com").is_ok());
    }
    #[test]
    fn autopilot_never_auto_approves_managed_policy() {
        let mut data = PermissionRequestData::default();
        assert!(!auto_approve(false, &data));
        assert!(auto_approve(true, &data));
        data.managed_approval_required = Some(true);
        assert!(!auto_approve(true, &data));
        data.managed_approval_required = Some(false);
        data.managed_settings_enabled = true;
        assert!(!auto_approve(true, &data));
    }
    #[tokio::test]
    async fn clear_cancels_permission_requests() {
        let bridge = Arc::new(Bridge::default());
        let task_bridge = bridge.clone();
        let task =
            tokio::spawn(async move { task_bridge.question(json!({"kind":"permission"})).await });
        tokio::task::yield_now().await;
        bridge.cancel();
        assert!(task.await.unwrap().is_none());
        assert!(bridge.pending.lock().unwrap().is_empty());
    }
    #[test]
    #[ignore = "Live inference: sends one harmless prompt in an isolated empty workspace"]
    fn installed_cli_responds_through_production_chat() {
        assert_eq!(
            std::env::var("SPEEDCODE_CHAT_LIVE_TEST").as_deref(),
            Ok("1")
        );
        let root =
            std::env::temp_dir().join(format!("speedcode-chat-check-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let backend = Backend::fixture(&root);
        let chat = Chat::new();
        let result = (|| -> Result<()> {
            let status = chat.handle(&backend, "chat_status", &json!({}))?;
            if status["authenticated"] != true {
                return Err("Live test requires existing CLI login".into());
            }
            let models = chat.handle(&backend, "chat_models", &json!({}))?;
            let model = models
                .as_array()
                .unwrap()
                .iter()
                .find(|m| m["policy"]["state"] != "disabled")
                .ok_or("No available model")?;
            chat.handle(&backend, "chat_send", &json!({"root":friendly(&root),"model":model["id"],"prompt":"Responda apenas OK. Não leia arquivos e não use ferramentas.","attachments":[]}))?;
            let until = std::time::Instant::now() + Duration::from_secs(90);
            let mut answer = String::new();
            while std::time::Instant::now() < until {
                let poll = chat.handle(&backend, "chat_poll", &json!({}))?;
                for e in poll["events"].as_array().unwrap() {
                    match e["type"].as_str().unwrap_or("") {
                        "request" => {
                            chat.handle(
                                &backend,
                                "chat_answer",
                                &json!({"id":e["id"],"approve":false}),
                            )?;
                        }
                        "assistant.message" => {
                            answer.push_str(e["data"]["content"].as_str().unwrap_or(""));
                        }
                        "session.error" | "bridge.error" => {
                            return Err(e["data"]["message"]
                                .as_str()
                                .unwrap_or("Runtime error")
                                .into());
                        }
                        _ => {}
                    }
                }
                if poll["busy"] == false && !answer.is_empty() {
                    let usage = chat.handle(&backend, "chat_usage", &json!({}))?;
                    assert_eq!(usage["available"], true, "Runtime metrics unavailable");
                    assert!(usage["outputTokens"].as_i64().unwrap() > 0);
                    println!("Production usage metrics: {usage}");
                    println!(
                        "Production chat: real assistant response received ({} characters)",
                        answer.len()
                    );
                    return Ok(());
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            Err("No assistant response within 90 seconds".into())
        })();
        chat.shutdown();
        // The test never grants tool permissions; only remove this empty fixture.
        let _ = std::fs::remove_dir(&root);
        assert!(result.is_ok(), "{result:?}");
    }
    #[test]
    #[ignore = "Read-only integration: requires the user's installed Copilot CLI"]
    fn installed_cli_supports_sdk_and_memory_fs() {
        let chat = Chat::new();
        let result = chat.rt().block_on(async {
            let mut state = chat.state.lock().await;
            chat.start(&mut state).await?;
            let auth = state
                .client
                .as_ref()
                .unwrap()
                .get_auth_status()
                .await
                .map_err(|e| e.to_string())?;
            if auth.is_authenticated {
                let models = state
                    .client
                    .as_ref()
                    .unwrap()
                    .list_models()
                    .await
                    .map_err(|e| e.to_string())?;
                println!(
                    "Copilot SDK: authenticated; {} models available (no prompt sent)",
                    models.len()
                );
                if let Some(model) = models.first() {
                    let config =
                        chat.session_config(&std::env::current_dir().unwrap(), &model.id, None);
                    let existing = state.client.as_ref().unwrap().rpc().mcp().config().list().await.map_err(|e| e.to_string())?;
                    let mut config = config;
                    config.disabled_mcp_servers = Some(existing.servers.into_keys().collect());
                    state.session = Some(
                        state
                            .client
                            .as_ref()
                            .unwrap()
                            .create_session(config)
                            .await
                            .map_err(|e| e.to_string())?.into(),
                    );
                    println!("Copilot SDK: real in-memory session created, without inference");
                    let session = state.session.as_ref().unwrap();
                    set_mode(session, true).await?;
                    assert_eq!(session.rpc().mode().get().await.map_err(|e|e.to_string())?, SessionMode::Autopilot);
                    set_mode(session, false).await?;
                    assert_eq!(session.rpc().mode().get().await.map_err(|e|e.to_string())?, SessionMode::Interactive);
                    println!("Copilot SDK: Autopilot and interactive modes applied and confirmed by runtime");
                }
            } else {
                println!("Copilot SDK: connected; authentication requires user login");
            }
            chat.stop(&mut state).await;
            Ok::<_, String>(())
        });
        chat.shutdown();
        assert!(result.is_ok(), "{result:?}");
    }
    #[test]
    #[ignore = "Read-only production session and diagnostics; existing CLI login, no inference"]
    fn installed_cli_context_diagnostics_without_inference() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        std::fs::write(
            root.join("Users.cs"),
            "class Users { public string GetUser() { return \"fixture\"; } }",
        )
        .unwrap();
        let backend = Backend::fixture(&root);
        let chat = Chat::new();
        chat.rt().block_on(async {
            chat.state.lock().await.isolated_mcp = true;
        });
        let result = (|| -> Result<()> {
            if chat.handle(&backend, "chat_status", &json!({}))?["authenticated"] != true {
                return Err("Requires existing CLI login".into());
            }
            let models = chat.handle(&backend, "chat_models", &json!({}))?;
            let model = models
                .as_array()
                .and_then(|m| m.first())
                .and_then(|m| m["id"].as_str())
                .ok_or("No available model")?;
            let begun = chat.handle(
                &backend,
                "chat_begin",
                &json!({"root":friendly(&root),"model":model,"localContext":true,"rustProxy":true}),
            )?;
            let diagnostics = chat.handle(&backend, "chat_diagnostics", &json!({}))?;
            assert_eq!(diagnostics["session"], true);
            let count = diagnostics["registeredLocalTools"].as_u64().unwrap();
            assert!(count == 0 || count == 3);
            if diagnostics["policy"] == "unavailable-native-fallback" {
                assert_eq!(count, 0);
            }
            assert!(diagnostics["runtime"]["version"].as_str().is_some());
            assert!(matches!(
                diagnostics["policy"].as_str(),
                Some("available" | "unavailable-native-fallback")
            ));
            println!(
                "Read-only production diagnostic: CLI {}; policy {}; {} local tools; no prompt sent",
                diagnostics["runtime"]["version"], diagnostics["policy"], count
            );
            let args = json!({"root":friendly(&root),"query":"GetUser"});
            let cold = chat.handle(&backend, "chat_context", &args)?;
            let hot = chat.handle(&backend, "chat_context", &args)?;
            assert_eq!(hot["bytesRead"], 0);
            assert_eq!(
                hot["results"][0]["contentHash"],
                cold["results"][0]["contentHash"]
            );
            assert_eq!(chat.bridge.session_info.lock().unwrap()["id"], begun["id"]);
            Ok(())
        })();
        chat.shutdown();
        assert!(result.is_ok(), "{result:?}");
    }
    #[test]
    #[ignore = "Live opt-in: isolated fixture, two prompts, context tools and temporary MCP processes"]
    fn productive_chat_context_and_multiple_mcp() {
        assert_eq!(
            std::env::var("SPEEDCODE_CHAT_LIVE_TEST").as_deref(),
            Ok("1")
        );
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        std::fs::write(
            root.join("Users.cs"),
            "app.MapGet(\"/users\", () => \"fixture\");\n",
        )
        .unwrap();
        let backend = Backend::fixture(&root);
        let chat = Chat::new();
        chat.rt().block_on(async {
            chat.state.lock().await.isolated_mcp = true;
        });
        let result = (|| -> Result<()> {
            if chat.handle(&backend, "chat_status", &json!({}))?["authenticated"] != true {
                return Err("Requires existing CLI login".into());
            }
            let models = chat.handle(&backend, "chat_models", &json!({}))?;
            let model = models
                .as_array()
                .unwrap()
                .iter()
                .find(|m| m["policy"]["state"] != "disabled")
                .ok_or("No model")?;
            let params = json!({"root":friendly(&root),"model":model["id"],"localContext":true});
            let info = chat.handle(&backend, "chat_begin", &params)?;
            let node = find_exe("node.exe").ok_or("Node fixture runtime missing")?;
            let script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("scripts/fixtures/mcp-test-server.mjs");
            let mut import = params.clone();
            import["config"] = json!({"mcpServers":{
                "primary":{"command":node,"args":[friendly(&script),friendly(&root.join("mcp-audit.txt")),"primary"]},
                "secondary":{"command":node,"args":[friendly(&script),friendly(&root.join("mcp-audit.txt")),"secondary"]}
            }});
            assert_eq!(
                chat.handle(&backend, "chat_mcp_connect", &import)?["failed"],
                0
            );
            let list = chat.handle(&backend, "chat_mcp_list", &json!({}))?;
            assert_eq!(
                list.as_array()
                    .unwrap()
                    .iter()
                    .filter(|s| s["managed"] == true && s["status"] == "connected")
                    .count(),
                2
            );
            for (action, status) in [
                ("pause", "paused"),
                ("resume", "connected"),
                ("disable", "disabled"),
                ("resume", "connected"),
            ] {
                chat.handle(
                    &backend,
                    "chat_mcp_action",
                    &json!({"name":"speedcode_secondary","action":action}),
                )?;
                let list = chat.handle(&backend, "chat_mcp_list", &json!({}))?;
                assert_eq!(
                    list.as_array()
                        .unwrap()
                        .iter()
                        .find(|s| s["name"] == "speedcode_secondary")
                        .unwrap()["status"],
                    status
                );
            }
            let collect = || -> Result<(String, Vec<Value>)> {
                let until = std::time::Instant::now() + Duration::from_secs(120);
                let mut answer = String::new();
                let mut events = Vec::new();
                while std::time::Instant::now() < until {
                    let poll = chat.handle(&backend, "chat_poll", &json!({}))?;
                    for e in poll["events"].as_array().unwrap() {
                        match e["type"].as_str().unwrap_or("") {
                            "request" => {
                                let req = &e["data"]["request"];
                                let fixture_path = friendly(&root.join("Users.cs"));
                                let request = req.get("permissionRequest").unwrap_or(req);
                                let file = ["path", "fileName", "filePath"]
                                    .iter()
                                    .find_map(|key| request[*key].as_str());
                                let fixture_file = file.is_some_and(|p| {
                                    p.replace('\\', "/")
                                        .eq_ignore_ascii_case(&fixture_path.replace('\\', "/"))
                                });
                                let fixture_root = file.is_some_and(|p| {
                                    p.replace('\\', "/")
                                        .eq_ignore_ascii_case(&friendly(&root).replace('\\', "/"))
                                });
                                let approve =
                                    matches!(
                                        req["kind"].as_str(),
                                        Some("custom-tool" | "customTool" | "mcp")
                                    ) || (matches!(req["kind"].as_str(), Some("read" | "write"))
                                        && fixture_file)
                                        || (req["kind"] == "read" && fixture_root);
                                if matches!(req["kind"].as_str(), Some("read" | "write")) {
                                    println!("Fixture permission approved={approve}: {req}");
                                }
                                chat.handle(
                                    &backend,
                                    "chat_answer",
                                    &json!({"id":e["id"],"approve":approve}),
                                )?;
                            }
                            "assistant.message" => {
                                answer.push_str(e["data"]["content"].as_str().unwrap_or(""))
                            }
                            "session.error" | "bridge.error" => {
                                return Err(e["data"]["message"]
                                    .as_str()
                                    .unwrap_or("Runtime error")
                                    .into());
                            }
                            _ => {}
                        }
                        events.push(e.clone());
                    }
                    if poll["busy"] == false && !answer.is_empty() {
                        return Ok((answer, events));
                    }
                    std::thread::sleep(Duration::from_millis(150));
                }
                Err("Live fixture timed out".into())
            };
            let mut send = params.clone();
            send["prompt"] = json!(
                "Use speedcode_search (query users), então speedcode_read para ler o endpoint SE a política estiver disponível. Se a política não estiver disponível, não repita as ferramentas Rust: use view nativo para ler Users.cs. Chame fixture_echo de AMBOS os MCPs speedcode_primary e speedcode_secondary. Altere APENAS Users.cs com edit nativo: rota /users deve virar /people, mantenha o restante. Leia depois para verificar. Responda rota original/final e frases dos MCPs. Lembre SAFIRA-711 nesta conversa. Não use shell nem outras ferramentas ou arquivos."
            );
            chat.handle(&backend, "chat_send", &send)?;
            let (answer, events) = collect()?;
            assert!(answer.contains("/users"), "No route in {answer}");
            assert!(
                events
                    .iter()
                    .any(|e| e["type"] == "bridge.context"
                        && e["data"]["tool"] == "speedcode_search"),
                "No Rust search call"
            );
            let policy_unavailable = events
                .iter()
                .any(|e| e["type"] == "bridge.context" && e["data"]["policyUnavailable"] == true);
            assert!(
                policy_unavailable
                    || events
                        .iter()
                        .any(|e| e["type"] == "bridge.context"
                            && e["data"]["tool"] == "speedcode_read"),
                "No Rust read or guarded native fallback"
            );
            assert_eq!(
                std::fs::read_to_string(root.join("Users.cs")).unwrap(),
                "app.MapGet(\"/people\", () => \"fixture\");\n",
                "Native endpoint edit failed"
            );
            println!(
                "Real native edit verified: /users -> /people; guarded fallback={policy_unavailable}"
            );
            let audit = std::fs::read_to_string(root.join("mcp-audit.txt"))
                .map_err(|_| "MCP tool was not called")?;
            assert!(
                audit.contains("primary:called") && audit.contains("secondary:called"),
                "Missing MCP call: {audit}"
            );
            let first = chat.handle(&backend, "chat_usage", &json!({}))?;
            println!("Live Rust tools + two MCPs called; first cumulative usage: {first}");
            // Same-model/reset-effort must still preserve the exact session identity.
            assert_eq!(
                chat.handle(&backend, "chat_model", &params)?["id"],
                info["id"]
            );
            chat.rt().block_on(async {
                let state = chat.state.lock().await;
                let session = state.session.as_ref().unwrap();
                chat.checkpoint_tokens(session).await;
                let result = switch_model(session, model["id"].as_str().unwrap(), None).await;
                chat.checkpoint_tokens(session).await;
                result
            })?;
            let compact = chat.handle(&backend, "chat_compact", &json!({}))?;
            println!("Manual compaction confirmed: {compact}");
            send["prompt"] = json!(
                "Qual foi a palavra que pedi para lembrar? Responda apenas a palavra. Não use ferramentas."
            );
            chat.handle(&backend, "chat_send", &send)?;
            let (answer, _) = collect()?;
            assert!(answer.contains("SAFIRA-711"), "Context lost: {answer}");
            let total = chat.handle(&backend, "chat_usage", &json!({}))?;
            println!("Usage after compact and second prompt: {total}");
            assert!(
                total["inputTokens"].as_f64().unwrap() >= first["inputTokens"].as_f64().unwrap()
            );
            assert!(
                total["outputTokens"].as_f64().unwrap() > first["outputTokens"].as_f64().unwrap()
            );
            println!("Session continuity after compaction; cumulative usage: {total}");
            chat.handle(
                &backend,
                "chat_mcp_action",
                &json!({"name":"speedcode_primary","action":"remove"}),
            )?;
            let list = chat.handle(&backend, "chat_mcp_list", &json!({}))?;
            assert!(
                !list
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|s| s["name"] == "speedcode_primary")
            );
            assert!(
                list.as_array()
                    .unwrap()
                    .iter()
                    .any(|s| s["name"] == "speedcode_secondary" && s["status"] == "connected")
            );
            assert_eq!(chat.bridge.session_info.lock().unwrap()["id"], info["id"]);
            Ok(())
        })();
        chat.shutdown();
        assert!(result.is_ok(), "{result:?}");
    }
}
