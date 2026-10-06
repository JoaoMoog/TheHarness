//! Worktrees are prepared once, on explicit chat admission, never by a watcher.
use crate::backend::{Backend, Result, friendly, git_ok, hash};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_REPOS: usize = 8;
const MAX_FILES: usize = 20_000;
const MAX_BYTES: u64 = 256 * 1024 * 1024;
static NEXT: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Repo {
    pub source: PathBuf,
    pub path: PathBuf,
    pub branch: String,
    pub base: String,
    pub source_branch: String,
    pub commit: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub root: PathBuf,
    pub repos: Vec<Repo>,
    pub status: String,
    pub readonly: Vec<PathBuf>,
}
impl Workspace {
    pub fn info(&self) -> Value {
        json!({"root":friendly(&self.root),"status":self.status,"repos":self.repos.iter().map(|r|
            json!({"source":friendly(&r.source),"path":friendly(&r.path),"branch":r.branch,"base":r.base,"sourceBranch":r.source_branch,"commit":r.commit})).collect::<Vec<_>>()})
    }
    pub fn map(&self, path: &Path) -> Result<PathBuf> {
        let path = path.canonicalize().map_err(|e| e.to_string())?;
        if path.starts_with(&self.root) {
            return Ok(path);
        }
        for repo in &self.repos {
            if let Ok(relative) = path.strip_prefix(&repo.source) {
                let mapped = Backend::path(&repo.path, &relative.to_string_lossy(), true)?;
                // Uncommitted/new/deleted paths are NOT silently copied or read from originals.
                return Ok(mapped);
            }
        }
        if self
            .readonly
            .iter()
            .any(|p| path == *p || (p.is_dir() && path.starts_with(p)))
        {
            return Ok(path);
        }
        Err("Referência não pertence às worktrees da tarefa. Anexe o repo antes de iniciar, ou use uma nova sessão. Nada enviado ao projeto original.".into())
    }
    pub fn instruction_dirs(&self) -> Result<Vec<PathBuf>> {
        let mut dirs = self
            .repos
            .iter()
            .map(|r| r.path.clone())
            .collect::<Vec<_>>();
        for repo in &self.repos {
            // Parent instructions outside Git do not appear in the new checkout.
            // Preserve their original relative includes as read-only, not copies.
            for parent in repo.source.ancestors().skip(1).take(16) {
                if (parent.join("AGENTS.md").is_file()
                    || parent.join(".github/copilot-instructions.md").is_file())
                    && !dirs.iter().any(|d| d == parent)
                {
                    dirs.push(parent.to_owned());
                }
            }
        }
        if dirs.len() > 32 {
            return Err("Mais de 32 diretórios de instruções herdadas. Reduza os repos; nenhuma instrução foi truncada.".into());
        }
        Ok(dirs)
    }
    pub fn mcp_config(&self, original: &Value) -> Result<Value> {
        let mut config = original.clone();
        if config.get("url").is_none() {
            let cwd = match config["cwd"].as_str() {
                Some(p) if Path::new(p).is_absolute() => self.map(Path::new(p))?,
                Some(p) => Backend::path(&self.root, p, true)?,
                None => self.root.clone(),
            };
            if !cwd.starts_with(&self.root) {
                return Err("MCP da tarefa deve usar cwd dentro das worktrees. Referências externas são só leitura, não diretórios de execução.".into());
            }
            config["cwd"] = json!(friendly(&cwd));
        }
        Ok(config)
    }
    pub fn guide(&self) -> String {
        format!(
            "SpeedCode managed worktree task. Working directory: {}. Worktree mode is already enforced for file modifications; do not ask the user to repeat worktree/branch instructions. Unless a different base was explicitly selected, each task starts at HEAD of that repository's CURRENT branch, without switching the original. All task code searches, edits, tests and Git working-tree operations must use these isolated paths, never original checkouts. Run Git in a repository child, not the task container. Read each repository's instructions and inherited instructions (including referenced files) before editing. The mapping below is workspace metadata, not repository instructions. Initial commits are recorded; no dirty/untracked files or dependencies were copied. Preserve reasoning and validation. Change bases/branches only if the user explicitly requests it, and only inside task worktrees. Never force-checkout a branch already in use, reset/stash/overwrite originals or delete worktrees. Native commands/MCP are not OS-sandboxed: use task paths and explicit human permissions. Closing/clearing chat preserves worktrees and branches.\n{}",
            friendly(&self.root),
            self.info()
        )
    }
}

fn text(root: &Path, args: &[&str]) -> Result<String> {
    Ok(String::from_utf8_lossy(&git_ok(root, args)?)
        .trim()
        .to_owned())
}
fn repo_root(path: &Path) -> Result<PathBuf> {
    let path = path.canonicalize().map_err(|e| e.to_string())?;
    let cwd = if path.is_dir() {
        path.as_path()
    } else {
        path.parent().ok_or("Referência sem diretório")?
    };
    let root = text(cwd, &["rev-parse", "--show-toplevel"])
        .map_err(|_| "Worktree exige projeto Git com commit. Para pastas não Git, desmarque Usar worktree antes de iniciar.".to_owned())?;
    PathBuf::from(root)
        .canonicalize()
        .map_err(|e| e.to_string())
}
fn slug(path: &Path) -> String {
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .take(24)
        .collect::<String>();
    format!("{}-{}", name, &hash(friendly(path).as_bytes())[..8])
}
fn inspect(root: &Path, base: &str, files: &mut usize, bytes: &mut u64) -> Result<String> {
    if base.is_empty()
        || base.len() > 256
        || base.starts_with('-')
        || base.contains(['\n', '\r', '\0'])
    {
        return Err(
            "Base Git inválida; use HEAD, origin/production, uma branch ou um commit.".into(),
        );
    }
    let commit = text(root, &["rev-parse", "--verify", "--end-of-options", &format!("{base}^{{commit}}")])
        .map_err(|_| format!("Base {base} não encontrada em {}. Faça Fetch ou escolha outra base; nenhuma worktree criada.", friendly(root)))?;
    let entries = git_ok(root, &["ls-tree", "-r", "-l", "-z", &commit])?;
    for row in entries.split(|b| *b == 0).filter(|r| !r.is_empty()) {
        let header = row.split(|b| *b == b'\t').next().unwrap();
        let fields = std::str::from_utf8(header)
            .map_err(|e| e.to_string())?
            .split_whitespace()
            .collect::<Vec<_>>();
        if fields.first() == Some(&"160000") {
            return Err("Worktree gerenciada com submodules ainda não suportada; projeto original preservado.".into());
        }
        if fields.first() == Some(&"120000") {
            return Err("Base contém links simbólicos. Não são admitidos em worktrees gerenciadas; use o fluxo externo.".into());
        }
        *files += 1;
        *bytes = bytes.saturating_add(
            fields
                .get(3)
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0),
        );
        if *files > MAX_FILES || *bytes > MAX_BYTES {
            return Err("Checkout da tarefa excede 20 mil arquivos ou 256 MiB rastreados. Reduza repos ou use worktree externa; nada foi removido.".into());
        }
    }
    Ok(commit)
}

pub fn prepare(
    primary: &Path,
    references: &[PathBuf],
    base: &str,
    storage: &Path,
) -> Result<Workspace> {
    let mut sources = vec![repo_root(primary)?];
    let mut readonly = Vec::new();
    for path in references {
        let source = match repo_root(path) {
            Ok(root) => root,
            Err(_) => {
                readonly.push(path.clone());
                continue;
            }
        };
        if !sources.contains(&source) {
            sources.push(source);
        }
        if sources.len() > MAX_REPOS {
            return Err("Até 8 repositórios por tarefa worktree; nenhuma worktree criada.".into());
        }
    }
    let (mut files, mut bytes) = (0, 0);
    let commits = sources
        .iter()
        .map(|r| inspect(r, base, &mut files, &mut bytes))
        .collect::<Result<Vec<_>>>()?;
    // Validate instructions admission before any Git mutation.
    let mut task = Workspace {
        root: PathBuf::new(),
        readonly,
        repos: sources
            .iter()
            .zip(commits)
            .map(|(r, c)| Repo {
                source: r.clone(),
                path: r.clone(),
                branch: String::new(),
                base: base.into(),
                source_branch: text(r, &["rev-parse", "--abbrev-ref", "HEAD"])
                    .unwrap_or_else(|_| "HEAD".into()),
                commit: c,
            })
            .collect(),
        status: "preparing".into(),
    };
    task.instruction_dirs()?;
    fs::create_dir_all(storage).map_err(|e| e.to_string())?;
    // Bounded metadata inventory, no recursive worktree scan or automatic cleanup.
    if fs::read_dir(storage)
        .map_err(|e| e.to_string())?
        .take(65)
        .count()
        >= 64
    {
        return Err("64 tarefas preservadas no armazenamento worktree. Revise/arquive manualmente antes de criar outra; nenhum trabalho foi apagado.".into());
    }
    let nonce = format!(
        "{}-{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos(),
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    );
    task.root = storage.join(format!("task-{nonce}"));
    fs::create_dir(&task.root).map_err(|e| e.to_string())?;
    task.root = task.root.canonicalize().map_err(|e| e.to_string())?;
    for repo in &mut task.repos {
        let name = slug(&repo.source);
        repo.path = task.root.join(&name);
        repo.branch = format!("speedcode/{nonce}/{name}");
    }
    let manifest = task.root.join("speedcode-worktrees.json");
    let write_manifest = |task: &Workspace| -> Result<()> {
        fs::write(
            &manifest,
            serde_json::to_vec_pretty(task).map_err(|e| e.to_string())?,
        )
        .map_err(|e| format!("Caminhos preservados em {}: {e}", friendly(&task.root)))
    };
    write_manifest(&task)?;
    for repo in &task.repos {
        if let Err(error) = git_ok(
            &repo.source,
            &[
                "-c",
                "core.hooksPath=NUL",
                "worktree",
                "add",
                "--no-track",
                "-b",
                &repo.branch,
                &friendly(&repo.path),
                &repo.commit,
            ],
        ) {
            task.status = "incomplete".into();
            let _ = write_manifest(&task);
            return Err(format!(
                "Preparação interrompida; caminhos/branches já criados foram preservados em {}. Sem retry automático, envio ou fallback no original. {error}",
                friendly(&task.root)
            ));
        }
    }
    task.status = "ready".into();
    // Instruction manifest contains only paths/branches/commits, no transcript.
    fs::write(task.root.join("AGENTS.md"), task.guide())
        .map_err(|e| format!("Worktrees preservadas em {}: {e}", friendly(&task.root)))?;
    write_manifest(&task)?;
    Ok(task)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn init(root: &Path) {
        fs::create_dir(root).unwrap();
        for args in [
            &["init", "-b", "main"][..],
            &["config", "core.autocrlf", "false"],
            &["config", "user.name", "Fixture"],
            &["config", "user.email", "fixture@example.invalid"],
        ] {
            git_ok(root, args).unwrap();
        }
        fs::write(root.join("code.txt"), "base\n").unwrap();
        fs::write(
            root.join("route.ts"),
            "export function endpointSpeed() { return 'ready'; }\n",
        )
        .unwrap();
        fs::write(
            root.join("AGENTS.md"),
            "Keep endpointSpeed tests and full reasoning.\n",
        )
        .unwrap();
        fs::write(root.join(".gitignore"), "node_modules/\n").unwrap();
        git_ok(root, &["add", "."]).unwrap();
        git_ok(root, &["commit", "-m", "base"]).unwrap();
        git_ok(root, &["branch", "production"]).unwrap();
        fs::write(root.join("code.txt"), "homologation\n").unwrap();
        git_ok(root, &["add", "."]).unwrap();
        git_ok(root, &["commit", "-m", "homologation"]).unwrap();
        git_ok(root, &["branch", "homologation"]).unwrap();
        fs::write(root.join("code.txt"), "dirty original\n").unwrap();
        fs::create_dir(root.join("node_modules")).unwrap();
        fs::write(root.join("node_modules/dependency.js"), "untouched\n").unwrap();
    }
    #[test]
    fn two_tasks_three_repos_same_or_different_bases_are_isolated_and_persistent() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().canonicalize().unwrap();
        let repos = [
            root.join("api one"),
            root.join("frontend"),
            root.join("library"),
        ];
        for repo in &repos {
            init(repo);
        }
        let a = prepare(&repos[0], &repos[1..], "production", &root.join("tasks")).unwrap();
        let b = prepare(&repos[0], &repos[1..], "homologation", &root.join("tasks")).unwrap();
        let c = prepare(&repos[0], &repos[1..], "production", &root.join("tasks")).unwrap();
        for repo in &repos {
            fs::write(repo.join(".git/info/exclude"), "ignored.ts\n").unwrap();
        }
        for repo in &a.repos {
            fs::write(
                repo.path.join("ignored.ts"),
                "export function endpointSpeedSecret() {}\n",
            )
            .unwrap();
        }
        let context = crate::chat_context::LocalContext::new(&a.root);
        let result = context
            .package(&json!({"query":"endpointSpeed","limit":20}))
            .unwrap();
        assert!(
            result["results"]
                .as_array()
                .unwrap()
                .iter()
                .all(|r| !r["path"].as_str().unwrap().ends_with("ignored.ts"))
        );
        for repo in &a.repos {
            assert!(result["results"].as_array().unwrap().iter().any(|r| {
                r["path"].as_str().unwrap().contains(&format!(
                    "{}/route.ts",
                    repo.path.file_name().unwrap().to_string_lossy()
                ))
            }));
        }
        let prefix = a.repos[1]
            .path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .to_string();
        let focused = context
            .search(&json!({"query":"endpointSpeed","pathPrefix":prefix}))
            .unwrap();
        assert!(
            focused["results"]
                .as_array()
                .unwrap()
                .iter()
                .all(|r| r["path"].as_str().unwrap().starts_with(&prefix))
        );
        for (i, original) in repos.iter().enumerate() {
            assert_eq!(
                fs::read_to_string(a.repos[i].path.join("code.txt")).unwrap(),
                "base\n"
            );
            assert_eq!(
                fs::read_to_string(b.repos[i].path.join("code.txt")).unwrap(),
                "homologation\n"
            );
            assert_ne!(a.repos[i].branch, c.repos[i].branch);
            fs::write(a.repos[i].path.join("code.txt"), "task A edit\n").unwrap();
            assert_eq!(
                fs::read_to_string(original.join("code.txt")).unwrap(),
                "dirty original\n"
            );
            assert_eq!(
                fs::read_to_string(b.repos[i].path.join("code.txt")).unwrap(),
                "homologation\n"
            );
            assert!(original.join("node_modules/dependency.js").exists());
            assert!(!a.repos[i].path.join("node_modules").exists());
            assert_eq!(
                a.map(&original.join("code.txt")).unwrap(),
                a.repos[i].path.join("code.txt")
            );
        }
        let path = a.root.clone();
        drop(a);
        assert!(path.join("speedcode-worktrees.json").is_file());
        assert!(path.join("AGENTS.md").is_file());
    }
    #[test]
    fn inherited_instructions_fs_permissions_mcp_and_unsupported_links() {
        use github_copilot_sdk::types::SessionFsProvider;
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().canonicalize().unwrap();
        let repo = root.join("repo");
        init(&repo);
        fs::write(
            root.join("AGENTS.md"),
            "Read rules.md before editing. Keep tests.",
        )
        .unwrap();
        fs::write(root.join("rules.md"), "Do not truncate instructions.").unwrap();
        let task = prepare(&repo, &[], "HEAD", &root.join("tasks")).unwrap();
        let dirs = task.instruction_dirs().unwrap();
        assert!(dirs.contains(&root));
        assert!(dirs.contains(&task.repos[0].path));
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let memory = crate::chat_memory::MemoryFs::for_workspace(&task.root);
            memory.set_references(dirs);
            assert_eq!(
                memory
                    .read_file(&friendly(&root.join("rules.md")))
                    .await
                    .unwrap(),
                "Do not truncate instructions."
            );
            assert!(
                memory
                    .write_file(&friendly(&repo.join("code.txt")), "outside", None)
                    .await
                    .is_err()
            );
            memory
                .write_file(
                    &friendly(&task.repos[0].path.join("code.txt")),
                    "isolated",
                    None,
                )
                .await
                .unwrap();
        });
        assert_eq!(
            task.mcp_config(&json!({"command":"fixture.exe"})).unwrap()["cwd"],
            friendly(&task.root)
        );
        assert_eq!(
            task.mcp_config(&json!({"command":"fixture.exe","cwd":friendly(&repo)}))
                .unwrap()["cwd"],
            friendly(&task.repos[0].path)
        );
        assert!(
            task.mcp_config(&json!({"command":"fixture.exe","cwd":"../outside"}))
                .is_err()
        );
        let commit = text(&repo, &["rev-parse", "HEAD"]).unwrap();
        git_ok(
            &repo,
            &[
                "update-index",
                "--add",
                "--cacheinfo",
                &format!("160000,{commit},submodule"),
            ],
        )
        .unwrap();
        git_ok(&repo, &["commit", "-m", "submodule fixture"]).unwrap();
        assert!(
            prepare(&repo, &[], "HEAD", &root.join("rejected"))
                .unwrap_err()
                .contains("submodules")
        );
        assert!(!root.join("rejected").exists());
        git_ok(&repo, &["update-index", "--force-remove", "submodule"]).unwrap();
        let blob = text(&repo, &["rev-parse", "HEAD:code.txt"]).unwrap();
        git_ok(
            &repo,
            &[
                "update-index",
                "--add",
                "--cacheinfo",
                &format!("120000,{blob},link"),
            ],
        )
        .unwrap();
        git_ok(&repo, &["commit", "-m", "link fixture"]).unwrap();
        assert!(
            prepare(&repo, &[], "HEAD", &root.join("rejected"))
                .unwrap_err()
                .contains("simbólicos")
        );
    }
    #[test]
    fn invalid_bases_non_git_uncommitted_paths_and_admission_do_not_fall_back() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().canonicalize().unwrap();
        let repo = root.join("repo");
        init(&repo);
        let storage = root.join("tasks");
        assert!(prepare(&repo, &[], "origin/missing", &storage).is_err());
        assert!(!storage.exists());
        assert!(prepare(&root, &[], "HEAD", &storage).is_err());
        let task = prepare(&repo, &[], "HEAD", &storage).unwrap();
        fs::write(repo.join("new.txt"), "new local").unwrap();
        assert!(task.map(&repo.join("new.txt")).is_err());
        assert!(task.map(&root).is_err());
        for i in 0..63 {
            fs::create_dir(storage.join(format!("old-{i}"))).unwrap();
        }
        assert!(
            prepare(&repo, &[], "HEAD", &storage)
                .unwrap_err()
                .contains("64 tarefas")
        );
        assert!(task.root.exists());
    }
}
