use crate::backend::{Result, friendly, hidden_command};
use base64::{Engine, engine::general_purpose::STANDARD};
use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex, mpsc},
    thread,
};
pub struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Box<dyn Child + Send + Sync>,
    rx: mpsc::Receiver<Vec<u8>>,
    root: String,
    profile: String,
}
pub struct Terminals {
    sessions: Mutex<HashMap<u64, Session>>,
    next: std::sync::atomic::AtomicU64,
}
pub fn environment_path() -> String {
    let mut paths = vec![std::env::var("PATH").unwrap_or_default()];
    #[cfg(windows)]
    {
        use winreg::{RegKey, enums::*};
        for (hive, key) in [
            (HKEY_CURRENT_USER, "Environment"),
            (
                HKEY_LOCAL_MACHINE,
                r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
            ),
        ] {
            if let Ok(k) = RegKey::predef(hive).open_subkey(key) {
                if let Ok(s) = k.get_value::<String, _>("Path") {
                    paths.push(s);
                }
            }
        }
    }
    let mut s = paths.join(";");
    for (key, val) in std::env::vars() {
        s = s.replace(&format!("%{key}%"), &val);
    }
    s
}
pub fn find_exe(name: &str) -> Option<PathBuf> {
    std::env::split_paths(&environment_path())
        .map(|d| d.join(name))
        .find(|p| p.is_file())
        .and_then(|p| p.canonicalize().ok())
}
pub fn diagnostics() -> Value {
    json!({"powershell":find_exe("powershell.exe").map(|p|friendly(&p)),"copilot":find_exe("copilot.exe").map(|p|friendly(&p)),"kiro":find_exe("kiro-cli.exe").map(|p|friendly(&p))})
}
impl Terminals {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next: std::sync::atomic::AtomicU64::new(1),
        }
    }
    pub fn start(&self, root: &Path, profile: &str, cols: u16, rows: u16) -> Result<Value> {
        let shell = find_exe("powershell.exe").ok_or("Windows PowerShell não encontrado.")?;
        // .NET Framework PowerShell 5.1 fails initialization with a \\?\ executable path.
        let mut cmd = CommandBuilder::new(friendly(&shell));
        cmd.args(["-NoLogo", "-NoExit"]);
        match profile {
            "powershell" => {}
            "copilot" | "kiro" => {
                let exe = find_exe(if profile == "copilot" {
                    "copilot.exe"
                } else {
                    "kiro-cli.exe"
                })
                .ok_or_else(|| format!("CLI {profile} não encontrado no PATH atual."))?;
                let command = format!(
                    "& '{}'{}",
                    friendly(&exe).replace('\'', "''"),
                    if profile == "kiro" { " chat" } else { "" }
                );
                cmd.args(["-Command", &command]);
            }
            _ => return Err("Perfil desconhecido.".into()),
        }
        cmd.cwd(friendly(root));
        self.spawn(root, profile, cols, rows, cmd)
    }
    pub fn launch(
        &self,
        root: &Path,
        profile: &str,
        script: &str,
        cols: u16,
        rows: u16,
    ) -> Result<Value> {
        let shell = find_exe("powershell.exe").ok_or("Windows PowerShell não encontrado.")?;
        let mut cmd = CommandBuilder::new(friendly(&shell));
        cmd.args(["-NoLogo", "-Command", script]);
        cmd.cwd(friendly(root));
        self.spawn(root, profile, cols, rows, cmd)
    }
    fn spawn(
        &self,
        root: &Path,
        profile: &str,
        cols: u16,
        rows: u16,
        mut cmd: CommandBuilder,
    ) -> Result<Value> {
        let mut sessions = self.sessions.lock().unwrap();
        if sessions.len() >= 8 {
            return Err("Limite de 8 sessões. Encerre uma sessão para abrir outra.".into());
        }
        cmd.env("PATH", environment_path());
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: rows.clamp(2, 200),
                cols: cols.clamp(10, 500),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        drop(pair.slave);
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let (tx, rx) = mpsc::sync_channel(32);
        thread::spawn(move || {
            let mut b = [0u8; 8192];
            loop {
                match reader.read(&mut b) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if tx.send(b[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                }
            }
        });
        let id = self.next.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let pid = child.process_id();
        sessions.insert(
            id,
            Session {
                master: pair.master,
                writer: Arc::new(Mutex::new(writer)),
                child,
                rx,
                root: friendly(root),
                profile: profile.into(),
            },
        );
        Ok(json!({"id":id,"pid":pid,"root":friendly(root),"profile":profile}))
    }
    pub fn poll(&self, id: u64) -> Result<Value> {
        let mut map = self.sessions.lock().unwrap();
        let s = map.get_mut(&id).ok_or("Sessão encerrada.")?;
        let mut bytes = Vec::new();
        for _ in 0..8 {
            match s.rx.try_recv() {
                Ok(b) => bytes.extend(b),
                Err(_) => break,
            }
        }
        let exit = s
            .child
            .try_wait()
            .map_err(|e| e.to_string())?
            .map(|e| e.exit_code());
        Ok(json!({"data":STANDARD.encode(bytes),"exit":exit,"root":s.root,"profile":s.profile}))
    }
    pub fn input(&self, id: u64, data: &str) -> Result<Value> {
        if data.len() > 1024 * 1024 {
            return Err("Entrada muito grande.".into());
        }
        let writer = self
            .sessions
            .lock()
            .unwrap()
            .get(&id)
            .ok_or("Sessão encerrada.")?
            .writer
            .clone();
        let mut writer = writer.lock().unwrap();
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
        Ok(json!(true))
    }
    pub fn resize(&self, id: u64, cols: u16, rows: u16) -> Result<Value> {
        let map = self.sessions.lock().unwrap();
        let s = map.get(&id).ok_or("Sessão encerrada.")?;
        s.master
            .resize(PtySize {
                cols: cols.clamp(10, 500),
                rows: rows.clamp(2, 200),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        Ok(json!(true))
    }
    pub fn close(&self, id: u64) -> Result<Value> {
        let session = self.sessions.lock().unwrap().remove(&id);
        if let Some(mut s) = session {
            if s.child.try_wait().ok().flatten().is_none() {
                if let Some(pid) = s.child.process_id() {
                    let _ = hidden_command("taskkill.exe")
                        .args(["/PID", &pid.to_string(), "/T", "/F"])
                        .output();
                }
            }
            let _ = s.child.kill();
        }
        Ok(json!(true))
    }
    pub fn close_all(&self) {
        let ids: Vec<_> = self.sessions.lock().unwrap().keys().copied().collect();
        for id in ids {
            let _ = self.close(id);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};
    #[test]
    fn two_real_powershell_sessions() {
        let t = tempfile::tempdir().unwrap();
        let terminals = Terminals::new();
        let a = terminals.start(t.path(), "powershell", 100, 25).unwrap()["id"]
            .as_u64()
            .unwrap();
        let b = terminals.start(t.path(), "powershell", 90, 20).unwrap()["id"]
            .as_u64()
            .unwrap();
        terminals.resize(a, 120, 30).unwrap();
        let now = Instant::now();
        let (mut out_a, mut out_b) = (Vec::new(), Vec::new());
        let (mut sent_a, mut sent_b) = (false, false);
        while now.elapsed() < Duration::from_secs(20) {
            for (id, out) in [(a, &mut out_a), (b, &mut out_b)] {
                let v = terminals.poll(id).unwrap();
                let bytes = STANDARD.decode(v["data"].as_str().unwrap()).unwrap();
                // ConPTY requests cursor position; xterm answers this in the UI.
                // The headless test must implement the same terminal handshake.
                if bytes.windows(4).any(|w| w == b"\x1b[6n") {
                    terminals.input(id, "\x1b[1;1R").unwrap();
                }
                out.extend(bytes);
            }
            if !sent_a && String::from_utf8_lossy(&out_a).contains("PS ") {
                terminals
                    .input(
                        a,
                        "Write-Output ('SPEED'+'CODE_PTY_OK'); (Get-Location).Path\r",
                    )
                    .unwrap();
                sent_a = true;
            }
            if !sent_b && String::from_utf8_lossy(&out_b).contains("PS ") {
                terminals
                    .input(b, "Write-Output ('SECOND'+'_SESSION_OK')\r")
                    .unwrap();
                sent_b = true;
            }
            if String::from_utf8_lossy(&out_a).contains("SPEEDCODE_PTY_OK")
                && String::from_utf8_lossy(&out_b).contains("SECOND_SESSION_OK")
            {
                break;
            }
            thread::sleep(Duration::from_millis(100));
        }
        terminals.input(a, "\u{3}").unwrap();
        terminals.close_all();
        assert!(
            String::from_utf8_lossy(&out_a).contains("SPEEDCODE_PTY_OK"),
            "{}",
            String::from_utf8_lossy(&out_a)
        );
        assert!(String::from_utf8_lossy(&out_b).contains("SECOND_SESSION_OK"));
    }
}
