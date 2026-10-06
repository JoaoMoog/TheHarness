//! Explicit, isolated formatters. Never saves a workspace file or runs project configuration.
use crate::backend::{Backend, Result, friendly, hidden_command, strarg};
use serde_json::{Value, json};
use std::{
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};
const MAX: usize = 512 * 1024;
fn run(mut command: Command, input: Option<String>) -> Result<String> {
    command
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|e| format!("Não foi possível iniciar formatador: {e}"))?;
    let writer = input.map(|input| {
        let mut stdin = child.stdin.take().unwrap();
        std::thread::spawn(move || stdin.write_all(input.as_bytes()))
    });
    fn drain<R: Read + Send + 'static>(mut stream: R) -> std::thread::JoinHandle<Vec<u8>> {
        std::thread::spawn(move || {
            let mut out = Vec::new();
            let mut chunk = [0; 8192];
            while let Ok(n) = stream.read(&mut chunk) {
                if n == 0 {
                    break;
                }
                let keep = n.min((MAX * 2 + 1).saturating_sub(out.len()));
                out.extend_from_slice(&chunk[..keep]);
            }
            out
        })
    }
    let stdout = drain(child.stdout.take().unwrap());
    let stderr = drain(child.stderr.take().unwrap());
    let start = Instant::now();
    let status = loop {
        if let Some(s) = child.try_wait().map_err(|e| e.to_string())? {
            break s;
        }
        if start.elapsed() > Duration::from_secs(30) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Formatação excedeu 30 segundos; buffer não alterado.".into());
        }
        std::thread::sleep(Duration::from_millis(25));
    };
    if let Some(writer) = writer {
        let _ = writer.join();
    }
    let out = stdout.join().map_err(|_| "Falha na saída do formatador")?;
    let err = stderr
        .join()
        .map_err(|_| "Falha no diagnóstico do formatador")?;
    if !status.success() {
        return Err(format!(
            "Formatação recusada; buffer preservado. {}",
            String::from_utf8_lossy(&err[..err.len().min(2000)])
        ));
    }
    if out.len() > MAX * 2 {
        return Err("Saída de formatação grande demais; buffer preservado.".into());
    }
    String::from_utf8(out).map_err(|_| "Formatador retornou texto inválido.".into())
}
fn ruff() -> Result<PathBuf> {
    let packaged = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.join("formatters/ruff.exe")));
    packaged
        .filter(|p| p.is_file())
        .or_else(|| {
            let p =
                Path::new(env!("CARGO_MANIFEST_DIR")).join("target/formatter-runtime/bin/ruff.exe");
            p.is_file().then_some(p)
        })
        .ok_or(
            "Ruff não encontrado. Execute scripts/setup-formatters.ps1 e gere o pacote novamente."
                .into(),
        )
}
pub fn format(root: &Path, p: &Value) -> Result<Value> {
    let path = strarg(p, "path")?;
    Backend::path(root, path, true)?;
    let text = strarg(p, "text")?;
    if text.len() > MAX {
        return Err("Formatação sob demanda limitada a 512 KiB; use o formatador externo para arquivos maiores.".into());
    }
    let tmp = tempfile::tempdir().map_err(|e| e.to_string())?;
    let ext = Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let formatted=match ext.as_str(){
        "py"|"pyi"=>{let exe=ruff()?;let mut c=hidden_command(&friendly(&exe));c.args(["format","--isolated","--no-cache","--stdin-filename","buffer.py","-"]).current_dir(tmp.path());run(c,Some(text.into()))?},
        "cs"=>{
            let exe=crate::terminal::find_exe("dotnet.exe").ok_or("Para formatar C#, instale o .NET SDK (6+). Nenhuma edição foi aplicada.")?;
            let file=tmp.path().join("buffer.cs");std::fs::write(&file,text).map_err(|e|e.to_string())?;
            std::fs::write(tmp.path().join(".editorconfig"),"root = true\n[*]\nindent_style = space\nindent_size = 4\n").map_err(|e|e.to_string())?;
            let mut c=hidden_command(&friendly(&exe));c.args(["format","whitespace","--folder",".","--include","buffer.cs","--verbosity","quiet"]).env("DOTNET_CLI_TELEMETRY_OPTOUT","1").env("DOTNET_NOLOGO","1").current_dir(tmp.path());run(c,None)?;
            std::fs::read_to_string(file).map_err(|e|e.to_string())?
        },
        _=>return Err("Esta linguagem não possui formatador configurado. Use a ação Reindentar linhas do editor.".into())
    };
    Ok(json!({"text":formatted,"formatter":if ext=="cs"{"dotnet format whitespace"}else{"Ruff"}}))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn python_preserves_strings_and_source() {
        let t = tempfile::tempdir().unwrap();
        let r = t.path().canonicalize().unwrap();
        std::fs::write(r.join("a.py"), "original").unwrap();
        let source = "def greet(  name ):\n    return { 'name':name, 'text':'  unchanged  ' }\n";
        let p = json!({"path":"a.py","text":source});
        let result = format(&r, &p).unwrap();
        assert!(result["text"].as_str().unwrap().contains("  unchanged  "));
        assert_eq!(std::fs::read_to_string(r.join("a.py")).unwrap(), "original");
        let again = format(&r, &json!({"path":"a.py","text":result["text"]})).unwrap();
        assert_eq!(result["text"], again["text"]);
        assert!(format(&r, &json!({"path":"a.py","text":"def invalid(:"})).is_err());
    }
    #[test]
    fn csharp_isolated_buffer() {
        if crate::terminal::find_exe("dotnet.exe").is_none() {
            return;
        }
        let t = tempfile::tempdir().unwrap();
        let r = t.path().canonicalize().unwrap();
        std::fs::write(r.join("a.cs"), "original").unwrap();
        let result=format(&r,&json!({"path":"a.cs","text":"class A {\npublic int Add(int a,int b){\nreturn a+b;\n}\n}\n"})).unwrap();
        assert!(result["text"].as_str().unwrap().contains("    public"));
        assert_eq!(std::fs::read_to_string(r.join("a.cs")).unwrap(), "original");
    }
}
