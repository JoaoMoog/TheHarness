//! Additional workspace operations. Preview pages never receive the application IPC bridge.
use crate::backend::{Backend, Result, friendly, git_blob, git_ok, hash, strarg, text_file};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
};

pub fn preview_url(b: &Backend, p: &Value) -> Result<String> {
    if let Some(path) = p["path"].as_str() {
        let root = b.root(strarg(p, "root")?)?;
        let file = Backend::path(&root, path, true)?;
        if !matches!(
            file.extension()
                .and_then(|v| v.to_str())
                .unwrap_or("")
                .to_lowercase()
                .as_str(),
            "html" | "htm"
        ) {
            return Err("Selecione um arquivo HTML.".into());
        }
        return url::Url::from_file_path(PathBuf::from(friendly(&file)))
            .map(|u| u.to_string())
            .map_err(|_| "URL local inválida.".into());
    }
    let u = url::Url::parse(strarg(p, "url")?).map_err(|e| e.to_string())?;
    if !matches!(u.scheme(), "http" | "https") || !u.username().is_empty() || u.password().is_some()
    {
        return Err("Use uma URL HTTP/HTTPS sem credenciais.".into());
    }
    Ok(u.to_string())
}

pub fn handle(b: &Backend, method: &str, p: &Value) -> Result<Value> {
    let root = b.root(strarg(p, "root")?)?;
    if method.starts_with("git_") && b.is_chat_container(&root) { return Err("Escolha um repositório dentro da tarefa para usar Git.".into()); }
    if method == "read_image" {
        let file = Backend::path(&root, strarg(p, "path")?, true)?;
        let ext = file
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let mime = match ext.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            "ico" => "image/x-icon",
            "svg" => "image/svg+xml",
            _ => return Err("Formato de imagem não suportado.".into()),
        };
        let limit = p["maxBytes"]
            .as_u64()
            .unwrap_or(crate::performance::IMAGE_BYTES)
            .clamp(64 * 1024, crate::performance::IMAGE_BYTES);
        let mut bytes = Vec::new();
        fs::File::open(file)
            .map_err(|e| e.to_string())?
            .take(limit + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() as u64 > limit {
            return Err(format!(
                "Imagem excede {} KiB nesta prévia; abra o arquivo no explorador.",
                limit / 1024
            ));
        }
        validate_image(&bytes, &ext)?;
        return Ok(
            json!({"dataUrl":format!("data:{mime};base64,{}",STANDARD.encode(&bytes)),"size":bytes.len(),"hash":hash(&bytes),"mime":mime}),
        );
    }
    let _lock = b.git_lock.lock().unwrap();
    if method == "git_stashes" || method.starts_with("git_stash_") {
        return crate::stash::handle(&root, method, p);
    }
    let output = |args: &[&str]| -> Result<String> {
        Ok(String::from_utf8_lossy(&git_ok(&root, args)?)
            .trim()
            .to_string())
    };
    match method {
        "git_remotes" => Ok(json!(output(&["remote"])?.lines().collect::<Vec<_>>())),
        "git_branch_create" => {
            let base = strarg(p, "ref")?;
            if !base.starts_with("refs/heads/") && !base.starts_with("refs/remotes/") {
                return Err("Escolha uma branch local ou remota existente.".into());
            }
            let name = strarg(p, "name")?;
            if name.starts_with('-') || name == "HEAD" || name.trim() != name {
                return Err("Nome de branch inválido.".into());
            }
            git_ok(&root, &["check-ref-format", "--branch", name])?;
            git_ok(&root, &["check-ref-format", &format!("refs/heads/{name}")])?;
            git_ok(&root, &["show-ref", "--verify", base])?;
            if p["switch"].as_bool().unwrap_or(true) {
                // Git carries compatible edits and atomically refuses overwrites.
                // Do not require a globally clean tree (hidden dependencies count
                // as untracked there). Never force, auto-stash or reset a branch.
                output(&[
                    "switch",
                    "--no-overwrite-ignore",
                    "--no-track",
                    "-c",
                    name,
                    base,
                ])?;
            } else {
                output(&["branch", "--no-track", name, base])?;
            }
            Ok(json!(true))
        }
        "git_publish" => {
            let remote = strarg(p, "remote")?;
            if remote.starts_with('-') {
                return Err("Nome de remoto inválido.".into());
            }
            if !output(&["remote"])?.lines().any(|r| r == remote) {
                return Err("Escolha um remoto cadastrado neste repositório.".into());
            }
            let name = output(&["symbolic-ref", "--quiet", "--short", "HEAD"])?;
            git_ok(&root, &["check-ref-format", "--branch", &name])?;
            let spec = format!("refs/heads/{name}:refs/heads/{name}");
            Ok(json!({"output":output(&["push", "--set-upstream", remote, &spec])?}))
        }
        "git_branches" => {
            let bytes = git_ok(
                &root,
                &[
                    "for-each-ref",
                    "--format=%(refname)%09%(refname:short)%09%(HEAD)%09%(upstream:short)%09%(symref)",
                    "refs/heads",
                    "refs/remotes",
                ],
            )?;
            let s = String::from_utf8_lossy(&bytes);
            if s.lines().take(1001).count() > 1000 {
                return Err(
                    "Mais de 1.000 branches: use git branch no terminal para evitar painel pesado."
                        .into(),
                );
            }
            let rows:Vec<_> = s.lines().filter_map(|line| {
                let a:Vec<_> = line.split('\t').collect();
                if a.len()<5 || !a[4].is_empty() {return None;}
                Some(json!({"ref":a[0],"name":a[1],"current":a[2]=="*","upstream":a[3],"remote":a[0].starts_with("refs/remotes/")}))
            }).collect();
            Ok(json!(rows))
        }
        "git_switch" | "git_branch_delete" => {
            let reference = strarg(p, "ref")?;
            if !reference.starts_with("refs/heads/") && !reference.starts_with("refs/remotes/") {
                return Err("Branch inválida.".into());
            }
            git_ok(&root, &["show-ref", "--verify", reference])?;
            let local = reference.strip_prefix("refs/heads/");
            if method == "git_branch_delete" {
                let name = local.ok_or("Apenas branches locais podem ser excluídas.")?;
                output(&["branch", "-d", "--", name])?;
            } else {
                if let Some(name) = local {
                    output(&["switch", "--no-overwrite-ignore", "--no-guess", "--", name])?;
                } else {
                    let remote = reference.strip_prefix("refs/remotes/").unwrap();
                    let (_, name) = remote.split_once('/').ok_or("Branch remota inválida.")?;
                    let locals = output(&[
                        "for-each-ref",
                        "--format=%(refname:short)%09%(upstream)",
                        "refs/heads",
                    ])?;
                    if let Some(existing) = locals.lines().find_map(|l| {
                        let (n, u) = l.split_once('\t')?;
                        (u == reference).then_some(n)
                    }) {
                        output(&[
                            "switch",
                            "--no-overwrite-ignore",
                            "--no-guess",
                            "--",
                            existing,
                        ])?;
                    } else {
                        output(&[
                            "switch",
                            "--no-overwrite-ignore",
                            "--track",
                            "-c",
                            name,
                            remote,
                        ])?;
                    }
                }
            }
            Ok(json!(true))
        }
        "git_conflict" => {
            let path = strarg(p, "path")?;
            Backend::path(&root, path, false)?;
            if output(&["ls-files", "-u", "--", path])?.is_empty() {
                return Err("Este arquivo não está em conflito.".into());
            }
            let stage = |i| -> Result<String> {
                let entries = output(&["ls-files", "-u", "--", path])?;
                if !entries.lines().any(|l| {
                    l.split('\t')
                        .next()
                        .unwrap_or("")
                        .ends_with(&format!(" {i}"))
                }) {
                    return Ok(String::new());
                }
                let spec = format!(":{i}:{path}");
                let bytes = git_blob(&root, &spec)?;
                Ok(text_file(&bytes)?.0)
            };
            Ok(json!({"base":stage(1)?,"ours":stage(2)?,"theirs":stage(3)?}))
        }
        "git_resolve" => {
            let path = strarg(p, "path")?;
            let file = Backend::path(&root, path, false)?;
            if output(&["ls-files", "-u", "--", path])?.is_empty() {
                return Err("Este arquivo não está em conflito.".into());
            }
            if file.exists() {
                let text = Backend::read(&root, path)?;
                if text["text"].as_str().unwrap().lines().any(|l| {
                    l.starts_with("<<<<<<<")
                        || l.starts_with("=======")
                        || l.starts_with(">>>>>>>")
                        || l.starts_with("|||||||")
                }) {
                    return Err("Remova os marcadores de conflito e salve o arquivo antes de marcar como resolvido.".into());
                }
            } else if !p["acceptDeletion"].as_bool().unwrap_or(false) {
                return Err("Arquivo ausente. Confirme a resolução por exclusão.".into());
            }
            output(&["add", "--", path])?;
            Ok(json!(true))
        }
        "git_merge_continue" | "git_merge_abort" => {
            let merge = output(&["rev-parse", "--git-path", "MERGE_HEAD"])?;
            if !root.join(merge).is_file() {
                return Err("Não há merge em andamento. Para conflitos de stash, resolva e faça um commit normal.".into());
            }
            if method == "git_merge_continue" {
                if !output(&["ls-files", "-u"])?.is_empty() {
                    return Err("Resolva todos os conflitos antes de completar o merge.".into());
                }
                Ok(json!({"output":output(&["-c","core.editor=true","commit","--no-edit"])?}))
            } else {
                Ok(json!({"output":output(&["merge","--abort"])?}))
            }
        }
        _ => Err("Operação não suportada.".into()),
    }
}

fn validate_image(bytes: &[u8], ext: &str) -> Result<()> {
    if ext == "svg" {
        // SVG has no bounded raster surface here and may contain animations.
        return Err("SVG: abra externamente; prévia integrada é reservada a imagens raster com dimensões verificadas.".into());
    }
    let reader = image::ImageReader::new(std::io::Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let (width, height) = reader
        .into_dimensions()
        .map_err(|_| "Imagem inválida ou formato não suportado.".to_string())?;
    if width == 0 || height == 0 || width as u64 * height as u64 > crate::performance::IMAGE_PIXELS
    {
        return Err(
            "Imagem excede 8 megapixels; abra externamente para evitar consumo alto de memória."
                .into(),
        );
    }
    // Animation playback can monopolize CPU in a long-lived IDE view.
    if ext == "gif"
        || (ext == "png" && bytes.windows(4).any(|v| v == b"acTL"))
        || (ext == "webp" && bytes.windows(4).any(|v| v == b"ANIM"))
    {
        return Err("Imagem animada: abra externamente para poupar processamento da IDE.".into());
    }
    Ok(())
}

pub struct Launcher {
    sources: Mutex<HashMap<String, String>>,
    catalog: PathBuf,
}
#[cfg(test)]
#[path = "workbench_tests.rs"]
mod tests;
pub struct Launch {
    pub name: String,
    pub script: String,
    pub ready: Value,
}
fn quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}
fn windows_config(v: &Value) -> Value {
    let mut result = v.clone();
    if let Some(overrides) = v["windows"].as_object() {
        for (key, value) in overrides {
            result[key] = value.clone();
        }
    }
    result
}
fn jsonc(path: &Path) -> Result<(Value, String)> {
    let bytes = fs::read(path).map_err(|e| format!("{}: {e}", friendly(path)))?;
    if bytes.len() > 4 * 1024 * 1024 {
        return Err("Configuração excede 4 MiB.".into());
    }
    let s = std::str::from_utf8(&bytes)
        .map_err(|_| "Configuração deve ser UTF-8.")?
        .trim_start_matches('\u{feff}');
    Ok((
        json5::from_str(s).map_err(|e| format!("JSONC inválido: {e}"))?,
        hash(&bytes),
    ))
}
fn expand(s: &str, root: &Path) -> Result<String> {
    let mut s = s
        .replace("${workspaceFolder}", &friendly(root))
        .replace("${workspaceRoot}", &friendly(root))
        .replace(
            "${workspaceFolderBasename}",
            root.file_name().unwrap_or_default().to_str().unwrap_or(""),
        );
    while let Some(start) = s.find("${env:") {
        let end = s[start..].find('}').ok_or("Variável incompleta.")? + start;
        let val = std::env::var(&s[start + 6..end])
            .map_err(|_| "Variável de ambiente não encontrada.")?;
        s.replace_range(start..=end, &val);
    }
    if s.contains("${") {
        return Err(format!(
            "Variável VS Code não suportada: {s}. Use workspaceFolder ou env:NAME."
        ));
    }
    Ok(s)
}
fn arguments(v: &Value, root: &Path) -> Result<String> {
    if v.is_null() {
        return Ok(String::new());
    }
    let a = v.as_array().ok_or("args deve ser um array de strings.")?;
    a.iter()
        .map(|x| {
            Ok(quote(&expand(
                x.as_str().ok_or("Argumento não textual.")?,
                root,
            )?))
        })
        .collect::<Result<Vec<_>>>()
        .map(|v| v.join(" "))
}
fn environment(v: &Value, root: &Path) -> Result<String> {
    let mut script = String::new();
    if v.is_null() {
        return Ok(script);
    }
    for (k, x) in v.as_object().ok_or("env deve ser um objeto.")? {
        if k.is_empty() || k.contains('=') || k.contains('\0') {
            return Err("Nome de variável inválido.".into());
        }
        script += &format!(
            "[Environment]::SetEnvironmentVariable({}, {}, 'Process');\n",
            quote(k),
            if x.is_null() {
                "$null".into()
            } else {
                quote(&expand(
                    x.as_str().ok_or("env deve conter strings ou null.")?,
                    root,
                )?)
            }
        );
    }
    Ok(script)
}
fn task_script(tasks: &Value, label: &str, root: &Path, stack: &mut Vec<String>) -> Result<String> {
    if stack.iter().any(|s| s == label) {
        return Err("Ciclo em dependsOn de tasks.json.".into());
    }
    stack.push(label.into());
    let t = tasks["tasks"]
        .as_array()
        .and_then(|a| a.iter().find(|v| v["label"] == label))
        .ok_or_else(|| format!("preLaunchTask '{label}' não encontrado em tasks.json."))?;
    let t = windows_config(t);
    if t["isBackground"].as_bool().unwrap_or(false) {
        return Err(
            "Tasks em background ainda não são suportadas. Use uma task de build finita.".into(),
        );
    }
    let mut script = String::new();
    let deps = match &t["dependsOn"] {
        Value::String(s) => vec![s.as_str()],
        Value::Array(a) => a
            .iter()
            .map(|x| x.as_str().ok_or_else(|| "dependsOn inválido.".to_string()))
            .collect::<Result<Vec<_>>>()?,
        _ => vec![],
    };
    for d in deps {
        script += &task_script(tasks, d, root, stack)?;
    }
    if let Some(command) = t["command"].as_str() {
        let cwd = expand(
            t["options"]["cwd"].as_str().unwrap_or("${workspaceFolder}"),
            root,
        )?;
        let cmd = expand(command, root)?;
        let kind = t["type"].as_str().unwrap_or("shell");
        if !matches!(kind, "shell" | "process") {
            return Err(format!(
                "Task type '{kind}' não suportado. Use shell/process."
            ));
        }
        // A task owns a child scope; its cwd/environment cannot leak into launch.
        script += &format!(
            "& {{ $taskEnv=@{{}}; Get-ChildItem Env: | ForEach-Object {{$taskEnv[$_.Name]=$_.Value}}; try {{ Push-Location {};\n{}$global:LASTEXITCODE=0; {} {}; if (!$? -or $LASTEXITCODE -ne 0) {{throw 'preLaunchTask falhou'}} }} finally {{ Pop-Location; Get-ChildItem Env: | ForEach-Object {{if (!$taskEnv.ContainsKey($_.Name)) {{[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}}}}; foreach ($k in $taskEnv.Keys) {{[Environment]::SetEnvironmentVariable($k,$taskEnv[$k],'Process')}} }} }};\n",
            quote(&cwd),
            environment(&t["options"]["env"], root)?,
            if kind == "process" {
                format!("& {}", quote(&cmd))
            } else {
                cmd
            },
            arguments(&t["args"], root)?
        );
    }
    stack.pop();
    Ok(script)
}
impl Launcher {
    pub fn new() -> Self {
        let catalog = crate::backend::data_dir().join("launch-sources.json");
        let sources = fs::read(&catalog)
            .ok()
            .and_then(|v| serde_json::from_slice(&v).ok())
            .unwrap_or_default();
        Self {
            sources: Mutex::new(sources),
            catalog,
        }
    }
    fn source(&self, root: &Path) -> PathBuf {
        self.sources
            .lock()
            .unwrap()
            .get(&friendly(root))
            .map(PathBuf::from)
            .unwrap_or_else(|| root.join(".vscode/launch.json"))
    }
    pub fn list(&self, root: &Path, import: bool) -> Result<Value> {
        if import {
            if let Some(p) = rfd::FileDialog::new()
                .add_filter("VS Code launch.json", &["json"])
                .pick_file()
            {
                jsonc(&p)?;
                let mut sources = self.sources.lock().unwrap();
                sources.insert(friendly(root), friendly(&p));
                fs::create_dir_all(self.catalog.parent().unwrap()).map_err(|e| e.to_string())?;
                fs::write(&self.catalog, serde_json::to_vec(&*sources).unwrap())
                    .map_err(|e| e.to_string())?;
            }
        }
        let source = self.source(root);
        if !source.exists() {
            return Ok(json!({"source":friendly(&source),"hash":"","configs":[]}));
        }
        let (v, h) = jsonc(&source)?;
        let a = v["configurations"]
            .as_array()
            .ok_or("launch.json precisa de configurations[].")?;
        let configs:Vec<_>=a.iter().enumerate().map(|(i,c)|json!({"index":i,"name":c["name"].as_str().unwrap_or("Sem nome"),"type":c["type"],"supported":c["request"]=="launch"&&matches!(c["type"].as_str(),Some("coreclr"|"clr"|"dotnet"))})).collect();
        Ok(json!({"source":friendly(&source),"hash":h,"configs":configs}))
    }
    pub fn prepare(&self, root: &Path, p: &Value) -> Result<Launch> {
        let source = self.source(root);
        let (v, h) = jsonc(&source)?;
        if p["hash"].as_str() != Some(&h) {
            return Err("launch.json mudou. Atualize as configurações antes de executar.".into());
        }
        let c = v["configurations"]
            .as_array()
            .and_then(|a| a.get(p["index"].as_u64()? as usize))
            .ok_or("Configuração não encontrada.")?;
        let c = windows_config(c);
        if c["request"] != "launch"
            || !matches!(c["type"].as_str(), Some("coreclr" | "clr" | "dotnet"))
        {
            return Err("Use request: launch e type: coreclr, clr ou dotnet. Attach e breakpoints não estão disponíveis.".into());
        }
        let mut script = "$ErrorActionPreference='Stop'; try {\n".to_string();
        if !c["preLaunchTask"].is_null() && !c["preLaunchTask"].is_string() {
            return Err(
                "preLaunchTask deve ser o label de uma task shell/process em tasks.json.".into(),
            );
        }
        if let Some(label) = c["preLaunchTask"].as_str() {
            let (tasks, _) = jsonc(&source.parent().unwrap().join("tasks.json"))?;
            script += &task_script(&tasks, label, root, &mut vec![])?;
        }
        let cwd = expand(c["cwd"].as_str().unwrap_or("${workspaceFolder}"), root)?;
        let cwd_path = if Path::new(&cwd).is_absolute() {
            PathBuf::from(&cwd)
        } else {
            root.join(&cwd)
        };
        if !cwd_path.is_dir() {
            return Err(format!(
                "Diretório de execução não existe: {}",
                friendly(&cwd_path)
            ));
        }
        let cwd = friendly(&cwd_path);
        script += &format!("Set-Location {};\n", quote(&cwd));
        let mut ready = c["serverReadyAction"].clone();
        if c["program"].is_string() && c["launchSettingsProfile"] != "" {
            let settings = if let Some(s) = c["launchSettingsFilePath"].as_str() {
                PathBuf::from(expand(s, root)?)
            } else {
                PathBuf::from(&cwd).join("Properties/launchSettings.json")
            };
            if settings.exists() {
                let (v, _) = jsonc(&settings)?;
                let profiles = v["profiles"]
                    .as_object()
                    .ok_or("launchSettings.json sem profiles.")?;
                let profile = if let Some(name) = c["launchSettingsProfile"].as_str() {
                    Some(
                        profiles
                            .get(name)
                            .ok_or("launchSettingsProfile não encontrado.")?,
                    )
                } else {
                    profiles.values().find(|v| v["commandName"] == "Project")
                };
                if let Some(profile) = profile {
                    if profile["commandName"] != "Project" {
                        return Err("Só launchSettingsProfile com commandName Project é suportado; IISExpress não é iniciado.".into());
                    }
                    script += &environment(&profile["environmentVariables"], root)?;
                    if let Some(url) = profile["applicationUrl"].as_str() {
                        script += &environment(&json!({"ASPNETCORE_URLS":url}), root)?;
                    }
                    if ready.is_null() && profile["launchBrowser"] == true {
                        ready = json!({"action":"openExternally","pattern":"\\bNow listening on:\\s+(https?://\\S+)"});
                        if let Some(route) = profile["launchUrl"].as_str().filter(|s| !s.is_empty())
                        {
                            ready["uriFormat"] = json!(if route.starts_with("http") {
                                route.to_string()
                            } else {
                                format!("%s/{}", route.trim_start_matches('/'))
                            });
                        }
                    }
                }
            }
        }
        script += &environment(&c["env"], root)?;
        let args = arguments(&c["args"], root)?;
        if let Some(program) = c["program"].as_str() {
            let prog = expand(program, root)?;
            script += &format!(
                "& {} {} {};\n",
                if prog.to_lowercase().ends_with(".dll") {
                    "'dotnet'".into()
                } else {
                    quote(&prog)
                },
                if prog.to_lowercase().ends_with(".dll") {
                    quote(&prog)
                } else {
                    String::new()
                },
                args
            );
        } else {
            let project = expand(
                c["projectPath"]
                    .as_str()
                    .ok_or("Informe program (.dll/.exe) ou projectPath (.csproj).")?,
                root,
            )?;
            let profile = c["launchSettingsProfile"].as_str();
            script += &format!(
                "& 'dotnet' run --project {} {} -- {};\n",
                quote(&project),
                match profile {
                    Some("") => "--no-launch-profile".into(),
                    Some(s) => format!("--launch-profile {}", quote(s)),
                    None => String::new(),
                },
                args
            );
        }
        script += "if ($null -ne $LASTEXITCODE) {exit $LASTEXITCODE}; exit 0 } catch { Write-Host $_ -ForegroundColor Red; exit 1 }";
        Ok(Launch {
            name: c["name"].as_str().unwrap_or(".NET").into(),
            script,
            ready,
        })
    }
}
