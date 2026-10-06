use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Output, Stdio},
    sync::Mutex,
};

pub type Result<T> = std::result::Result<T, String>;
pub const MAX_FILE: u64 = 4 * 1024 * 1024;
pub fn data_dir() -> PathBuf {
    std::env::var_os("SPEEDCODE_DATA_DIR")
        .or_else(|| std::env::var_os("AGENTDESK_DATA_DIR"))
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            profile_dir(&PathBuf::from(
                std::env::var_os("LOCALAPPDATA").unwrap_or_default(),
            ))
        })
}
fn profile_dir(base: &Path) -> PathBuf {
    let current = base.join("SpeedCode");
    let legacy = base.join("AgentDeskLite");
    // Reuse the existing profile in place; never recursively copy a WebView cache.
    if !current.is_dir() && legacy.is_dir() {
        legacy
    } else {
        current
    }
}
fn catalog_root(path: &str) -> PathBuf {
    let current = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let legacy = current.parent().unwrap().join("AgentDeskLite");
    let parsed = PathBuf::from(path);
    if friendly(&parsed).eq_ignore_ascii_case(&friendly(&legacy)) && !parsed.exists() {
        current
    } else {
        parsed
    }
}
pub struct Backend {
    pub roots: Mutex<Vec<PathBuf>>,
    chat_roots: Mutex<Vec<PathBuf>>,
    pub git_lock: Mutex<()>,
    save_lock: Mutex<()>,
    catalog: PathBuf,
}
pub fn friendly(p: &Path) -> String {
    let s = p.to_string_lossy();
    if let Some(t) = s.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{t}")
    } else {
        s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
    }
}
pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn stamp(meta: &fs::Metadata) -> String {
    format!(
        "{}:{}",
        meta.len(),
        meta.modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    )
}
pub fn hidden_command(exe: &str) -> Command {
    let mut c = Command::new(exe);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x08000000);
    }
    c
}
pub fn git(root: &Path, args: &[&str]) -> Result<Output> {
    let mut command = hidden_command("git");
    // Stash generates its own :(literal) pathspecs while cleaning untracked files.
    // Inheriting --literal-pathspecs would treat that magic prefix as a filename.
    if args.first() != Some(&"stash") {
        command.arg("--literal-pathspecs");
    }
    let mut child = command
        .args(args)
        // Git child commands (notably stash -> clean) need a regular Windows cwd,
        // not the extended-length prefix returned by canonicalize().
        .current_dir(friendly(root))
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("LC_ALL", "C")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Git: {e}"))?;
    fn drain(mut reader: impl Read, limit: usize) -> Vec<u8> {
        let mut out = Vec::new();
        let mut block = [0u8; 8192];
        while let Ok(n) = reader.read(&mut block) {
            if n == 0 {
                break;
            }
            let take = n.min((limit + 1).saturating_sub(out.len()));
            out.extend_from_slice(&block[..take]);
        }
        out
    }
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let a = std::thread::spawn(move || drain(stdout, 8 * 1024 * 1024));
    let b = std::thread::spawn(move || drain(stderr, 1024 * 1024));
    // Match commands, not a user message/path equal to "status". Never timeout
    // a mutating stash push/apply/drop midway through saving/cleaning files.
    let read_only = args.first() == Some(&"status")
        || (args.first() == Some(&"--no-literal-pathspecs") && args.get(1) == Some(&"status"))
        || (args.first() == Some(&"stash") && matches!(args.get(1), Some(&"list" | &"show")))
        || matches!(args.first(), Some(&"cat-file" | &"rev-parse" | &"ls-tree"));
    let status = if read_only {
        let start = std::time::Instant::now();
        loop {
            if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
                break status;
            }
            if start.elapsed() > std::time::Duration::from_secs(10) {
                let _ = child.kill();
                let _ = child.wait();
                let _ = a.join();
                let _ = b.join();
                return Err("Leitura Git excedeu 10 s; selecione uma pasta menor ou use o terminal. Arquivos preservados.".into());
            }
            std::thread::sleep(std::time::Duration::from_millis(25));
        }
    } else {
        child.wait().map_err(|e| e.to_string())?
    };
    Ok(Output {
        status,
        stdout: a.join().unwrap_or_default(),
        stderr: b.join().unwrap_or_default(),
    })
}
fn read_limited(path: &Path) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(MAX_FILE + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > MAX_FILE as usize {
        return Err("Arquivo excede 4 MiB.".into());
    }
    Ok(bytes)
}
pub(crate) fn git_blob(root: &Path, spec: &str) -> Result<Vec<u8>> {
    let output = git(root, &["show", spec])?;
    if output.status.success() {
        if output.stdout.len() > MAX_FILE as usize {
            return Err("Diff excede 4 MiB.".into());
        }
        return Ok(output.stdout);
    }
    let err = String::from_utf8_lossy(&output.stderr);
    if err.contains("does not exist in")
        || err.contains("exists on disk, but not in")
        || err.contains("invalid object name 'HEAD'")
        || err.contains("path '") && err.contains("not in the index")
        || err.contains("is in the index, but not at stage")
    {
        Ok(Vec::new())
    } else {
        Err(format!("Não foi possível ler a base Git: {}", err.trim()))
    }
}
pub(crate) fn git_ok(root: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let o = git(root, args)?;
    if !o.status.success() {
        return Err(String::from_utf8_lossy(&o.stderr).trim().to_string());
    }
    if o.stdout.len() > 8 * 1024 * 1024 {
        return Err("Saída Git excede 8 MiB; use o terminal para esta operação.".into());
    }
    Ok(o.stdout)
}
pub fn text_file(bytes: &[u8]) -> Result<(String, bool, String)> {
    if bytes.len() > MAX_FILE as usize {
        return Err("Arquivo excede 4 MiB.".into());
    }
    if bytes.contains(&0) {
        return Err("Arquivo binário ou UTF-16 não pode ser editado nesta versão.".into());
    }
    let bom = bytes.starts_with(&[239, 187, 191]);
    let raw = if bom { &bytes[3..] } else { bytes };
    let text = std::str::from_utf8(raw)
        .map_err(|_| "O arquivo não é UTF-8.")?
        .to_string();
    let eol = if text.contains("\r\n") { "CRLF" } else { "LF" };
    Ok((text, bom, eol.into()))
}
impl Backend {
    #[cfg(test)]
    pub(crate) fn fixture(root: &Path) -> Self {
        Self {
            roots: Mutex::new(vec![root.canonicalize().unwrap()]),
            chat_roots: Mutex::new(Vec::new()),
            git_lock: Mutex::new(()),
            save_lock: Mutex::new(()),
            catalog: root.join("catalog"),
        }
    }
    pub fn load() -> Self {
        let catalog = data_dir().join("repositories.txt");
        let mut roots: Vec<_> = fs::read_to_string(&catalog)
            .unwrap_or_default()
            .lines()
            .filter_map(|p| catalog_root(p).canonicalize().ok())
            .filter(|p| p.is_dir())
            .collect();
        if roots.is_empty() {
            if let Ok(p) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).canonicalize() {
                roots.push(p);
            }
        }
        Self {
            roots: Mutex::new(roots),
            chat_roots: Mutex::new(Vec::new()),
            git_lock: Mutex::new(()),
            save_lock: Mutex::new(()),
            catalog,
        }
    }
    pub fn list(&self) -> Value {
        json!(self.roots.lock().unwrap().iter().map(|p|json!({"path":friendly(p),"name":p.file_name().unwrap_or_default().to_string_lossy()})).collect::<Vec<_>>())
    }
    pub fn add(&self, path: &str) -> Result<Value> {
        let mut p = PathBuf::from(path)
            .canonicalize()
            .map_err(|e| e.to_string())?;
        if !p.is_dir() {
            return Err("Selecione uma pasta.".into());
        }
        if let Ok(top) = git_ok(&p, &["rev-parse", "--show-toplevel"]) {
            if let Ok(t) = PathBuf::from(String::from_utf8_lossy(&top).trim()).canonicalize() {
                p = t;
            }
        }
        let mut roots = self.roots.lock().unwrap();
        if !roots.contains(&p) {
            roots.push(p);
        }
        fs::create_dir_all(self.catalog.parent().unwrap()).map_err(|e| e.to_string())?;
        fs::write(
            &self.catalog,
            roots
                .iter()
                .filter(|p| !self.chat_roots.lock().unwrap().contains(p))
                .map(|p| friendly(p))
                .collect::<Vec<_>>()
                .join("\n"),
        )
        .map_err(|e| e.to_string())?;
        drop(roots);
        Ok(self.list())
    }
    pub fn root(&self, s: &str) -> Result<PathBuf> {
        let p = PathBuf::from(s).canonicalize().map_err(|e| e.to_string())?;
        if !self.roots.lock().unwrap().contains(&p) {
            return Err("Workspace não cadastrado.".into());
        }
        Ok(p)
    }
    // Managed task paths are registered in memory only, never normalized to an
    // enclosing original Git repo or written into the shared profile catalog.
    pub(crate) fn register_chat_root(&self, path: &Path) {
        let mut roots = self.roots.lock().unwrap();
        if !roots.iter().any(|p| p == path) {
            roots.push(path.to_owned());
        }
        let mut managed = self.chat_roots.lock().unwrap();
        if !managed.iter().any(|p| p == path) {
            managed.push(path.to_owned());
        }
    }
    pub(crate) fn is_chat_container(&self, root: &Path) -> bool {
        self.chat_roots.lock().unwrap().contains(&root.to_owned())
            && root.join("speedcode-worktrees.json").is_file()
    }
    pub fn path(root: &Path, relative: &str, existing: bool) -> Result<PathBuf> {
        let rel = Path::new(relative);
        if relative.contains(':')
            || rel.is_absolute()
            || rel
                .components()
                .any(|c| !matches!(c, Component::Normal(_) | Component::CurDir))
        {
            return Err("Caminho fora do workspace.".into());
        }
        let mut p = root.to_path_buf();
        for c in rel.components() {
            p.push(c);
            if let Ok(m) = fs::symlink_metadata(&p) {
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    if m.file_attributes() & 0x400 != 0 {
                        return Err("Links/reparse points não são seguidos.".into());
                    }
                }
                if m.file_type().is_symlink() {
                    return Err("Links não são seguidos.".into());
                }
            }
        }
        if existing {
            let c = p.canonicalize().map_err(|e| e.to_string())?;
            if !c.starts_with(root) {
                return Err("Caminho fora do workspace.".into());
            }
            Ok(c)
        } else {
            // All components were checked above. Missing parents are legitimate for
            // Git deletions; create/rename will still fail if the parent is absent.
            Ok(p)
        }
    }
    pub fn read(root: &Path, path: &str) -> Result<Value> {
        let p = Self::path(root, path, true)?;
        if fs::metadata(&p).map_err(|e| e.to_string())?.len() > MAX_FILE {
            return Err("Arquivo excede 4 MiB.".into());
        }
        let before = stamp(&fs::metadata(&p).map_err(|e| e.to_string())?);
        let bytes = read_limited(&p)?;
        let after = stamp(&fs::metadata(&p).map_err(|e| e.to_string())?);
        let (text, bom, eol) = text_file(&bytes)?;
        Ok(
            json!({"text":text,"hash":hash(&bytes),"bom":bom,"eol":eol,"stamp":if before==after{Some(after)}else{None}}),
        )
    }
    fn save(&self, root: &Path, p: &Value) -> Result<Value> {
        let _guard = self.save_lock.lock().unwrap();
        let relative = strarg(p, "path")?;
        let path = Self::path(root, relative, true)?;
        let original = read_limited(&path)?;
        if hash(&original) != strarg(p, "hash")? {
            return Err(
                "CONFLICT: arquivo alterado no disco. Recarregue ou compare antes de salvar."
                    .into(),
            );
        }
        let (.., bom, eol) = text_file(&original)?;
        let mut text = strarg(p, "text")?.replace("\r\n", "\n");
        if eol == "CRLF" {
            text = text.replace('\n', "\r\n");
        }
        let mut bytes = if bom { vec![239, 187, 191] } else { Vec::new() };
        bytes.extend(text.as_bytes());
        if bytes.len() > MAX_FILE as usize {
            return Err("Conteúdo excede 4 MiB.".into());
        }
        let temp = path.with_file_name(format!(
            ".speedcode-save-{}-{}.tmp",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let result = (|| {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp)
                .map_err(|e| e.to_string())?;
            file.write_all(&bytes).map_err(|e| e.to_string())?;
            file.sync_all().map_err(|e| e.to_string())?;
            fs::set_permissions(
                &temp,
                fs::metadata(&path)
                    .map_err(|e| e.to_string())?
                    .permissions(),
            )
            .map_err(|e| e.to_string())?;
            if hash(&fs::read(&path).map_err(|e| e.to_string())?) != hash(&original) {
                return Err("CONFLICT: arquivo mudou durante salvamento.".into());
            }
            drop(file);
            fs::rename(&temp, &path).map_err(|e| e.to_string())?;
            Ok(
                json!({"hash":hash(&bytes),"stamp":stamp(&fs::metadata(&path).map_err(|e|e.to_string())?)}),
            )
        })();
        if temp.exists() {
            let _ = fs::remove_file(temp);
        }
        result
    }
    pub fn handle(&self, method: &str, p: &Value) -> Result<Value> {
        if method == "repos" {
            return Ok(self.list());
        }
        if method == "add_repo" {
            return self.add(strarg(p, "path")?);
        }
        if method == "browse" {
            return match rfd::FileDialog::new().pick_folder() {
                Some(p) => self.add(&friendly(&p)),
                None => Ok(self.list()),
            };
        }
        let root = self.root(strarg(p, "root")?)?;
        if method == "git_group" && self.is_chat_container(&root) {
            return Err("Escolha um repositório dentro da tarefa para usar Git.".into());
        }
        match method {
            "file_stamp" => {
                let path = Self::path(&root, strarg(p, "path")?, false)?;
                Ok(json!(fs::metadata(path).ok().map(|m| stamp(&m))))
            }
            "format_code" => crate::formatting::format(&root, p),
            "git_group" => crate::scm::status_for_group(&root, strarg(p, "path")?),
            "read_if_changed" => {
                let path = Self::path(&root, strarg(p, "path")?, true)?;
                let current = stamp(&fs::metadata(path).map_err(|e| e.to_string())?);
                if p["force"] != true && p["stamp"].as_str() == Some(&current) {
                    Ok(json!({"unchanged":true,"stamp":current}))
                } else {
                    let mut value = Self::read(&root, strarg(p, "path")?)?;
                    if value["hash"] == p["hash"] {
                        value = json!({"unchanged":true,"stamp":value["stamp"]});
                    }
                    Ok(value)
                }
            }
            "tree" => {
                let dir = Self::path(&root, p["path"].as_str().unwrap_or(""), true)?;
                let mut items = Vec::new();
                for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
                    if items.len() >= 1000 {
                        items.push(json!({"truncated":true}));
                        break;
                    }
                    let e = entry.map_err(|e| e.to_string())?;
                    let m = fs::symlink_metadata(e.path()).map_err(|e| e.to_string())?;
                    #[cfg(windows)]
                    {
                        use std::os::windows::fs::MetadataExt;
                        if m.file_attributes() & 0x400 != 0 {
                            continue;
                        }
                    }
                    if m.file_type().is_symlink() {
                        continue;
                    }
                    let name = e.file_name().to_string_lossy().to_string();
                    if name == ".git"
                        || (!p["showGenerated"].as_bool().unwrap_or(false)
                            && matches!(
                                name.as_str(),
                                "target" | "node_modules" | ".next" | ".build" | ".jtk-cache"
                            ))
                    {
                        continue;
                    }
                    let path = e
                        .path()
                        .strip_prefix(&root)
                        .unwrap()
                        .to_string_lossy()
                        .replace('\\', "/");
                    items.push(json!({"name":name,"path":path,"dir":m.is_dir()}));
                }
                items.sort_by_key(|e| {
                    (
                        !e["dir"].as_bool().unwrap_or(false),
                        e["name"].as_str().unwrap_or("~").to_lowercase(),
                    )
                });
                Ok(json!(items))
            }
            "read" => Self::read(&root, strarg(p, "path")?),
            "save" => self.save(&root, p),
            "create" => {
                let path = Self::path(&root, strarg(p, "path")?, false)?;
                if p["directory"].as_bool().unwrap_or(false) {
                    fs::create_dir(path).map_err(|e| e.to_string())?;
                } else {
                    fs::OpenOptions::new()
                        .write(true)
                        .create_new(true)
                        .open(path)
                        .map_err(|e| e.to_string())?;
                }
                Ok(json!(true))
            }
            "rename" => {
                let from = Self::path(&root, strarg(p, "path")?, true)?;
                let to = Self::path(&root, strarg(p, "destination")?, false)?;
                if to.exists() {
                    return Err("O destino já existe.".into());
                }
                fs::rename(from, to).map_err(|e| e.to_string())?;
                Ok(json!(true))
            }
            "git_status" => {
                if self.is_chat_container(&root) {
                    return Ok(json!({"available":false,"entries":[]}));
                }
                let _g = self.git_lock.lock().unwrap();
                if git_ok(&root, &["rev-parse", "--git-dir"]).is_err() {
                    return Ok(json!({"available":false,"entries":[]}));
                }
                let mut v = crate::scm::status(&root, None)?;
                v["available"] = json!(true);
                let upstream = git_ok(
                    &root,
                    &[
                        "rev-parse",
                        "--abbrev-ref",
                        "--symbolic-full-name",
                        "@{upstream}",
                    ],
                )
                .ok()
                .map(|b| String::from_utf8_lossy(&b).trim().to_string());
                v["upstream"] = json!(upstream);
                let merge = git_ok(&root, &["rev-parse", "--git-path", "MERGE_HEAD"])?;
                v["mergeInProgress"] =
                    json!(root.join(String::from_utf8_lossy(&merge).trim()).is_file());
                v["signature"] = json!(hash(v.to_string().as_bytes()));
                Ok(v)
            }
            "git_diff" => {
                if self.is_chat_container(&root) {
                    return Err("Escolha um repositório dentro da tarefa para usar Git.".into());
                }
                let _g = self.git_lock.lock().unwrap();
                let path = strarg(p, "path")?;
                Self::path(&root, path, false)?;
                let staged = p["staged"].as_bool().unwrap_or(false);
                let oldpath = p["oldPath"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .unwrap_or(path);
                let base = if staged {
                    format!("HEAD:{oldpath}")
                } else {
                    format!(":{path}")
                };
                let original = git_blob(&root, &base)?;
                let modified = if staged {
                    git_blob(&root, &format!(":{path}"))?
                } else {
                    let file = Self::path(&root, path, false)?;
                    if file.exists() {
                        read_limited(&Self::path(&root, path, true)?)?
                    } else {
                        Vec::new()
                    }
                };
                let (original, ..) = text_file(&original)?;
                let (modified, ..) = text_file(&modified)?;
                crate::performance::validate_diff(&original)?;
                crate::performance::validate_diff(&modified)?;
                Ok(
                    json!({"original":original,"modified":modified,"label":if staged{"HEAD → index"}else{"index → arquivo no disco"}}),
                )
            }
            "git_action" => {
                if self.is_chat_container(&root) {
                    return Err("Escolha um repositório dentro da tarefa para usar Git.".into());
                }
                let _g = self.git_lock.lock().unwrap();
                let action = strarg(p, "action")?;
                if action == "commit" {
                    crate::scm::guard_commit(&root)?;
                }
                if action == "stage_all" || action == "unstage_all" {
                    let entries = crate::scm::all_visible(&root)?;
                    let mut paths = Vec::<String>::new();
                    for e in entries {
                        if e["conflict"] == true {
                            return Err("Resolva conflitos antes de uma ação em todos.".into());
                        }
                        if action == "unstage_all" && (e["x"] == " " || e["x"] == "?") {
                            continue;
                        }
                        paths.push(e["path"].as_str().unwrap().into());
                        if let Some(old) = e["oldPath"].as_str() {
                            paths.push(old.into());
                        }
                    }
                    paths.sort();
                    paths.dedup();
                    if paths.iter().map(String::len).sum::<usize>() > 16000 {
                        return Err("Escopo grande demais; use ações individuais.".into());
                    }
                    if paths.is_empty() {
                        return Ok(json!({"success":true,"output":"Nenhum arquivo elegível."}));
                    }
                    let mut args = if action == "stage_all" {
                        vec!["add", "-A", "--"]
                    } else if git_ok(&root, &["rev-parse", "--verify", "HEAD"]).is_err() {
                        vec!["rm", "--cached", "--"]
                    } else {
                        vec!["reset", "-q", "HEAD", "--"]
                    };
                    args.extend(paths.iter().map(String::as_str));
                    git_ok(&root, &args)?;
                    return Ok(
                        json!({"success":true,"output":format!("{} caminhos elegíveis atualizados; dependências/ignorados preservados.",paths.len())}),
                    );
                }
                let path = p["path"].as_str().unwrap_or("");
                if !path.is_empty() {
                    Self::path(&root, path, false)?;
                    if action == "stage" && (path.ends_with('/') || crate::scm::dependency(path)) {
                        return Err("Expanda a pasta e selecione arquivos elegíveis; dependências não são preparadas pela IDE.".into());
                    }
                    if action == "stage"
                        && !crate::scm::ignored(&root, &[path.to_owned()])?.is_empty()
                    {
                        return Err(
                            "Arquivo ignorado pelo projeto; não será preparado pela IDE.".into(),
                        );
                    }
                }
                let mut args: Vec<&str> = match action {
                    "stage" => vec!["add", "--", path],
                    "stage_all" => vec!["add", "-A"],
                    "unstage" => vec!["reset", "-q", "HEAD", "--", path],
                    "unstage_all" => vec!["reset", "-q"],
                    "discard" | "discard_all" => Vec::new(),
                    "commit" => {
                        let msg = strarg(p, "message")?;
                        if msg.trim().is_empty() {
                            return Err("Informe a mensagem do commit.".into());
                        }
                        vec!["commit", "-m", msg]
                    }
                    "fetch" => vec!["fetch"],
                    "pull" => vec!["pull", "--no-rebase", "--no-edit"],
                    "push" => vec!["push"],
                    "publish" => vec!["push", "--set-upstream", "origin", "HEAD"],
                    _ => return Err("Ação Git não suportada.".into()),
                };
                if action == "stage" || action == "unstage" {
                    if let Some(old) = p["oldPath"].as_str().filter(|s| !s.is_empty()) {
                        Self::path(&root, old, false)?;
                        args.push(old);
                    }
                }
                if action == "unstage" && git_ok(&root, &["rev-parse", "--verify", "HEAD"]).is_err()
                {
                    args = vec!["rm", "--cached", "--", path];
                }
                if action == "discard" || action == "discard_all" {
                    if path.ends_with('/') && action == "discard" {
                        return Err(
                            "Expanda a pasta antes de descartar arquivos individuais.".into()
                        );
                    }
                    let entries = if action == "discard_all" {
                        crate::scm::all_visible(&root)?
                    } else {
                        crate::scm::status(&root, Some(path))?["entries"]
                            .as_array()
                            .unwrap()
                            .clone()
                    };
                    let wanted: Vec<_> = if action == "discard_all" {
                        entries
                    } else {
                        entries
                            .into_iter()
                            .filter(|e| e["path"].as_str() == Some(path))
                            .collect()
                    };
                    for entry in wanted {
                        let paths = [entry["path"].as_str(), entry["oldPath"].as_str()];
                        for relative in paths.into_iter().flatten().filter(|s| !s.is_empty()) {
                            let file = Self::path(&root, relative, false)?;
                            let head_spec = format!("HEAD:{relative}");
                            let in_head = git(&root, &["cat-file", "-e", &head_spec])
                                .map(|o| o.status.success())
                                .unwrap_or(false);
                            if in_head {
                                let _ = git(
                                    &root,
                                    &["restore", "--worktree", "--source=HEAD", "--", relative],
                                );
                            }
                            let _ = git(&root, &["reset", "-q", "HEAD", "--", relative]);
                            if !in_head && file.is_file() {
                                fs::remove_file(&file).map_err(|e| e.to_string())?;
                            }
                        }
                    }
                    return Ok(
                        json!({"output":if action == "discard_all" {"Todas as alterações foram descartadas."} else {"Alteração descartada."},"success":true}),
                    );
                }
                let o = git(&root, &args)?;
                let log = format!(
                    "{}{}",
                    String::from_utf8_lossy(&o.stdout),
                    String::from_utf8_lossy(&o.stderr)
                );
                if !o.status.success() {
                    return Err(format!("Git {action}: {}", log.trim()));
                }
                Ok(json!({"output":log,"success":true}))
            }
            _ => Err(format!("Método desconhecido: {method}")),
        }
    }
}
pub fn strarg<'a>(p: &'a Value, key: &str) -> Result<&'a str> {
    p[key]
        .as_str()
        .ok_or_else(|| format!("Parâmetro ausente: {key}"))
}
pub fn parse_status(bytes: &[u8]) -> Value {
    let mut parts = bytes.split(|b| *b == 0);
    let mut branch = String::new();
    let mut entries = Vec::new();
    while let Some(part) = parts.next() {
        if part.starts_with(b"## ") {
            branch = String::from_utf8_lossy(&part[3..]).into_owned();
            continue;
        }
        if part.len() < 4 {
            continue;
        }
        let x = part[0] as char;
        let y = part[1] as char;
        let path = String::from_utf8_lossy(&part[3..]).into_owned();
        let old = if x == 'R' || x == 'C' || y == 'R' || y == 'C' {
            parts
                .next()
                .map(|b| String::from_utf8_lossy(b).into_owned())
        } else {
            None
        };
        entries.push(json!({"path":path,"oldPath":old,"x":x.to_string(),"y":y.to_string(),"conflict":x=='U'||y=='U'||(x=='A'&&y=='A')||(x=='D'&&y=='D')}));
    }
    json!({"branch":branch,"entries":entries})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rebrand_reuses_legacy_profile_without_copying_it() {
        let t = tempfile::tempdir().unwrap();
        assert_eq!(profile_dir(t.path()), t.path().join("SpeedCode"));
        fs::create_dir(t.path().join("AgentDeskLite")).unwrap();
        assert_eq!(profile_dir(t.path()), t.path().join("AgentDeskLite"));
        fs::create_dir(t.path().join("SpeedCode")).unwrap();
        assert_eq!(profile_dir(t.path()), t.path().join("SpeedCode"));
    }
    #[test]
    fn renamed_catalog_maps_only_the_moved_application_repo() {
        let current = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let old = current.parent().unwrap().join("AgentDeskLite");
        if !old.exists() {
            assert_eq!(catalog_root(&friendly(&old)), current);
        }
        assert_eq!(
            catalog_root("C:/other/AgentDeskLite"),
            PathBuf::from("C:/other/AgentDeskLite")
        );
    }
    fn run(p: &Path, a: &[&str]) {
        let o = git(p, a).unwrap();
        assert!(
            o.status.success(),
            "{:?}: {}",
            a,
            String::from_utf8_lossy(&o.stderr)
        );
    }
    #[test]
    fn real_git_files_and_local_remote() {
        let t = tempfile::tempdir().unwrap();
        let a = t.path().join("a");
        let b = t.path().join("b");
        let remote = t.path().join("remote.git");
        fs::create_dir(&a).unwrap();
        run(t.path(), &["init", "--bare", remote.to_str().unwrap()]);
        run(&a, &["init", "-b", "main"]);
        run(&a, &["config", "user.name", "SpeedCode Test"]);
        run(&a, &["config", "user.email", "test@example.invalid"]);
        let root = a.canonicalize().unwrap();
        let backend = Backend {
            roots: Mutex::new(vec![root.clone()]),
            chat_roots: Mutex::new(Vec::new()),
            git_lock: Mutex::new(()),
            save_lock: Mutex::new(()),
            catalog: t.path().join("catalog"),
        };
        let mut p = json!({"root":friendly(&root),"path":"olá arquivo.txt"});
        fs::write(a.join("olá arquivo.txt"), b"\xef\xbb\xbfantes\r\n").unwrap();
        let read = Backend::read(&root, "olá arquivo.txt").unwrap();
        p["hash"] = read["hash"].clone();
        p["text"] = json!("depois\n");
        backend.handle("save", &p).unwrap();
        assert_eq!(
            fs::read(a.join("olá arquivo.txt")).unwrap(),
            b"\xef\xbb\xbfdepois\r\n"
        );
        assert!(
            backend
                .handle("save", &p)
                .unwrap_err()
                .starts_with("CONFLICT")
        );
        assert!(Backend::path(&root, "../escape", false).is_err());
        p["action"] = json!("stage");
        backend.handle("git_action", &p).unwrap();
        p["staged"] = json!(true);
        assert!(
            backend.handle("git_diff", &p).unwrap()["modified"]
                .as_str()
                .unwrap()
                .contains("depois")
        );
        p["action"] = json!("commit");
        p["message"] = json!("initial");
        backend.handle("git_action", &p).unwrap();
        run(&a, &["remote", "add", "origin", remote.to_str().unwrap()]);
        p["action"] = json!("publish");
        backend.handle("git_action", &p).unwrap();
        run(
            t.path(),
            &[
                "clone",
                "-b",
                "main",
                remote.to_str().unwrap(),
                b.to_str().unwrap(),
            ],
        );
        run(&b, &["config", "user.name", "SpeedCode Test"]);
        run(&b, &["config", "user.email", "test@example.invalid"]);
        fs::write(b.join("externo.txt"), "agente externo\n").unwrap();
        run(&b, &["add", "."]);
        run(&b, &["commit", "-m", "external"]);
        run(&b, &["push"]);
        p["action"] = json!("pull");
        backend.handle("git_action", &p).unwrap();
        assert!(a.join("externo.txt").exists());
        fs::write(a.join("externo.txt"), "mudança externa\n").unwrap();
        let s = backend.handle("git_status", &p).unwrap();
        assert!(
            s["entries"]
                .as_array()
                .unwrap()
                .iter()
                .any(|e| e["path"] == "externo.txt")
        );
        p["path"] = json!("externo.txt");
        p["staged"] = json!(false);
        let d = backend.handle("git_diff", &p).unwrap();
        assert!(d["original"].as_str().unwrap().contains("agente externo"));
        assert!(d["modified"].as_str().unwrap().contains("mudança externa"));
        p["action"] = json!("stage");
        backend.handle("git_action", &p).unwrap();
        p["action"] = json!("unstage");
        backend.handle("git_action", &p).unwrap();
        fs::rename(a.join("externo.txt"), a.join("renomeado.txt")).unwrap();
        run(&a, &["add", "-A"]);
        let s = backend.handle("git_status", &p).unwrap();
        assert!(!s["entries"].as_array().unwrap().is_empty());
    }
    #[test]
    fn nul_rename_and_conflict() {
        let s=parse_status(b"## main...origin/main\0R  novo nome.txt\0antigo nome.txt\0UU conflict.txt\0?? novo.txt\0");
        assert_eq!(s["entries"][0]["oldPath"], "antigo nome.txt");
        assert_eq!(s["entries"][1]["conflict"], true);
        assert_eq!(s["entries"].as_array().unwrap().len(), 3);
    }
    #[test]
    fn unchanged_reads_skip_text_and_forced_hash_detects_changes() {
        let t = tempfile::tempdir().unwrap();
        let root = t.path().canonicalize().unwrap();
        let backend = Backend::fixture(&root);
        fs::write(root.join("a.ts"), "before").unwrap();
        let original = Backend::read(&root, "a.ts").unwrap();
        let mut p = json!({"root":friendly(&root),"path":"a.ts","stamp":original["stamp"],"hash":original["hash"]});
        let unchanged = backend.handle("read_if_changed", &p).unwrap();
        assert_eq!(unchanged["unchanged"], true);
        assert!(unchanged.get("text").is_none());
        fs::write(root.join("a.ts"), "after!").unwrap();
        p["force"] = json!(true);
        let changed = backend.handle("read_if_changed", &p).unwrap();
        assert_eq!(changed["text"], "after!");
        assert_ne!(changed["hash"], original["hash"]);
    }
}
