//! Stash operations share the Git lock in workbench. No working-tree scan on expansion.
use crate::backend::{Backend, Result, git, git_ok, strarg, text_file};
use serde_json::{Value, json};
use std::{collections::BTreeSet, io::Write, path::Path};

fn output(root: &Path, args: &[&str]) -> Result<String> {
    let out = git(root, args)?;
    if !out.status.success() {
        // Keep useful errors, not thousands of CRLF warnings in the WebView/DOM.
        let err = String::from_utf8_lossy(&out.stderr);
        let lines: Vec<_> = err
            .lines()
            .filter(|l| !l.starts_with("warning:"))
            .take(20)
            .collect();
        let message: String = lines.join("\n").chars().take(4000).collect();
        return Err(if message.is_empty() {
            "Git não concluiu a operação. Confira o terminal e a lista de stashes; nada será repetido automaticamente.".into()
        } else {
            message
        });
    }
    if out.stdout.len() > 8 * 1024 * 1024 {
        return Err("Saída do stash excedeu o limite; use o terminal.".into());
    }
    Ok(String::from_utf8_lossy(&out.stdout)
        .trim()
        .chars()
        .take(4000)
        .collect())
}
fn list(root: &Path) -> Result<Value> {
    let bytes = git_ok(
        root,
        &["stash", "list", "-n", "501", "--format=%H%x09%gd%x09%gs"],
    )?;
    let text = String::from_utf8_lossy(&bytes);
    if text.lines().count() > 500 {
        return Err("Mais de 500 stashes: use git stash list no terminal.".into());
    }
    Ok(json!(
        text.lines()
            .filter_map(|line| {
                let mut parts = line.splitn(3, '\t');
                Some(json!({"oid":parts.next()?,"selector":parts.next()?,"message":parts.next()?}))
            })
            .collect::<Vec<_>>()
    ))
}
fn selector(root: &Path, oid: &str) -> Result<String> {
    list(root)?
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["oid"] == oid)
        .and_then(|s| s["selector"].as_str())
        .map(str::to_owned)
        .ok_or("Stash não existe mais. Atualize a lista.".into())
}
fn files(root: &Path, oid: &str) -> Result<Vec<String>> {
    let bytes = git_ok(
        root,
        &[
            "stash",
            "show",
            "--name-only",
            "--no-renames",
            "--include-untracked",
            "-z",
            oid,
        ],
    )?;
    let mut paths = BTreeSet::new();
    for path in bytes.split(|b| *b == 0).filter(|p| !p.is_empty()) {
        let path =
            std::str::from_utf8(path).map_err(|_| "Caminho Git não é UTF-8; use o terminal.")?;
        paths.insert(path.to_owned());
        if paths.len() > 2000 {
            return Err("Stash com mais de 2.000 arquivos; visualize pelo terminal. Nenhum conteúdo foi carregado.".into());
        }
    }
    Ok(paths.into_iter().collect())
}
fn blob(root: &Path, spec: &str) -> Result<Vec<u8>> {
    // cat-file resolves an exact object path, not git show's revision/path wildcards.
    let out = git(root, &["cat-file", "blob", spec])?;
    if !out.status.success() {
        let error = String::from_utf8_lossy(&out.stderr);
        if error.contains("does not exist in")
            || error.contains("not in")
            || error.contains("Not a valid object name")
        {
            return Ok(Vec::new());
        }
        return Err(error.chars().take(4000).collect());
    }
    if out.stdout.len() > 4 * 1024 * 1024 {
        return Err("Arquivo do stash excede 4 MiB; use o terminal.".into());
    }
    Ok(out.stdout)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    fn fixture() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        for args in [
            vec!["init", "-b", "main"],
            vec!["config", "user.name", "Test"],
            vec!["config", "user.email", "test@example.invalid"],
            vec!["config", "core.autocrlf", "true"],
        ] {
            git_ok(root, &args).unwrap();
        }
        fs::write(root.join("code.txt"), "base\n").unwrap();
        fs::write(root.join("hidden.txt"), "private base\n").unwrap();
        git_ok(root, &["add", "."]).unwrap();
        git_ok(root, &["commit", "-m", "base"]).unwrap();
        dir
    }
    #[test]
    fn scoped_stash_preserves_dependencies_ignored_and_supports_demand_files_apply_drop() {
        let dir = fixture();
        let root = dir.path();
        fs::write(root.join(".gitignore"), "hidden.txt\nsecret.txt\n").unwrap();
        git_ok(root, &["add", ".gitignore"]).unwrap();
        git_ok(root, &["commit", "-m", "ignore"]).unwrap();
        fs::create_dir(root.join("node_modules")).unwrap();
        for i in 0..1000 {
            fs::write(root.join(format!("node_modules/{i}.js")), "dependency\n").unwrap();
        }
        fs::write(root.join("hidden.txt"), "private edit\n").unwrap();
        fs::write(root.join("secret.txt"), "secret\n").unwrap();
        fs::write(root.join("code.txt"), "changed\n").unwrap();
        fs::write(root.join("[literal].txt"), "new\n").unwrap();
        handle(root, "git_stash_create", &json!({"message":"named work"})).unwrap();
        assert!(!root.join("[literal].txt").exists());
        assert!(root.join("node_modules/999.js").exists());
        assert_eq!(
            fs::read_to_string(root.join("hidden.txt")).unwrap(),
            "private edit\n"
        );
        assert!(root.join("secret.txt").exists());
        let items = list(root).unwrap();
        let oid = items[0]["oid"].as_str().unwrap();
        let p = json!({"oid":oid});
        let names = handle(root, "git_stash_files", &p).unwrap();
        assert_eq!(names["paths"], json!(["[literal].txt", "code.txt"]));
        let d = handle(
            root,
            "git_stash_diff",
            &json!({"oid":oid,"path":"[literal].txt"}),
        )
        .unwrap();
        assert_eq!(d["modified"], "new\n");
        assert!(
            handle(
                root,
                "git_stash_diff",
                &json!({"oid":oid,"path":"hidden.txt"})
            )
            .is_err()
        );
        handle(root, "git_stash_apply", &p).unwrap();
        assert!(root.join("[literal].txt").exists());
        assert_eq!(list(root).unwrap().as_array().unwrap().len(), 1);
        handle(root, "git_stash_drop", &p).unwrap();
        assert!(list(root).unwrap().as_array().unwrap().is_empty());
        assert!(handle(root, "git_stash_drop", &p).is_err());
    }
    #[test]
    fn stash_limits_and_hidden_index_preserve_every_file() {
        let dir = fixture();
        let root = dir.path();
        fs::create_dir(root.join("node_modules")).unwrap();
        fs::write(root.join("node_modules/staged.js"), "dep\n").unwrap();
        git_ok(root, &["add", "node_modules/staged.js"]).unwrap();
        fs::write(root.join("code.txt"), "changed\n").unwrap();
        assert!(handle(root, "git_stash_create", &json!({"message":"blocked"})).is_err());
        assert!(root.join("node_modules/staged.js").exists());
        assert!(list(root).unwrap().as_array().unwrap().is_empty());
        git_ok(root, &["restore", "--staged", "node_modules/staged.js"]).unwrap();
        for i in 0..201 {
            fs::write(root.join(format!("new{i}.txt")), "new\n").unwrap();
        }
        assert!(handle(root, "git_stash_create", &json!({"message":"too big"})).is_err());
        assert!(root.join("new200.txt").exists());
        assert!(list(root).unwrap().as_array().unwrap().is_empty());
    }
    #[test]
    fn stash_deleted_empty_rename_paths_and_stable_oid() {
        let dir = fixture();
        let root = dir.path();
        fs::rename(root.join("code.txt"), root.join("renamed.txt")).unwrap();
        fs::write(root.join("empty.txt"), "").unwrap();
        git_ok(root, &["add", "-A"]).unwrap();
        handle(root, "git_stash_create", &json!({"message":"first"})).unwrap();
        let first = list(root).unwrap()[0]["oid"].as_str().unwrap().to_owned();
        let names = files(root, &first).unwrap();
        assert!(names.contains(&"code.txt".into()));
        assert!(names.contains(&"renamed.txt".into()));
        let d = handle(
            root,
            "git_stash_diff",
            &json!({"oid":first,"path":"code.txt"}),
        )
        .unwrap();
        assert_eq!(d["modified"], "");
        fs::write(root.join("next.txt"), "next\n").unwrap();
        handle(root, "git_stash_create", &json!({"message":"second"})).unwrap();
        handle(root, "git_stash_drop", &json!({"oid":first})).unwrap();
        assert!(
            list(root).unwrap()[0]["message"]
                .as_str()
                .unwrap()
                .contains("second")
        );
    }
    #[test]
    fn stash_adversarial_metadata_and_diff_budgets_preserve_stash() {
        let dir = fixture();
        let root = dir.path();
        git_ok(root, &["config", "core.autocrlf", "false"]).unwrap();
        fs::create_dir(root.join("many")).unwrap();
        for i in 0..2001 {
            fs::write(root.join(format!("many/{i}.txt")), "item\n").unwrap();
        }
        git_ok(root, &["stash", "push", "-u", "-m", "external large stash"]).unwrap();
        let oid = list(root).unwrap()[0]["oid"].as_str().unwrap().to_owned();
        assert!(files(root, &oid).unwrap_err().contains("2.000"));
        fs::write(root.join("big.txt"), "x".repeat(512 * 1024 + 1)).unwrap();
        handle(root, "git_stash_create", &json!({"message":"status"})).unwrap();
        let current = list(root).unwrap()[0]["oid"].as_str().unwrap().to_owned();
        assert!(
            handle(
                root,
                "git_stash_diff",
                &json!({"oid":current,"path":"big.txt"})
            )
            .is_err()
        );
        assert_eq!(list(root).unwrap().as_array().unwrap().len(), 2);
    }
    #[test]
    fn stash_refuses_hidden_staged_rename_without_mutating_index_or_files() {
        let dir = fixture();
        let root = dir.path();
        fs::write(root.join(".gitignore"), "hidden.txt\n").unwrap();
        git_ok(root, &["add", ".gitignore"]).unwrap();
        git_ok(root, &["commit", "-m", "ignore"]).unwrap();
        fs::rename(root.join("hidden.txt"), root.join("visible.txt")).unwrap();
        git_ok(root, &["add", "-A"]).unwrap();
        fs::write(root.join("code.txt"), "visible work\n").unwrap();
        let before = git_ok(root, &["diff", "--cached"]).unwrap();
        assert!(
            handle(
                root,
                "git_stash_create",
                &json!({"message":"hidden rename"})
            )
            .is_err()
        );
        assert_eq!(before, git_ok(root, &["diff", "--cached"]).unwrap());
        assert!(root.join("visible.txt").exists());
        assert!(list(root).unwrap().as_array().unwrap().is_empty());
    }
}
pub fn handle(root: &Path, method: &str, p: &Value) -> Result<Value> {
    if method == "git_stashes" {
        return list(root);
    }
    if method == "git_stash_create" {
        let message = strarg(p, "message")?.trim();
        if message.is_empty() || message.len() > 1024 {
            return Err("Informe uma descrição de até 1.024 bytes.".into());
        }
        // Git snapshots the whole index even with pathspecs: refuse hidden staged edits.
        crate::scm::guard_commit(root).map_err(|_| "O índice contém alterações ocultas ou não pôde ser validado. Revise os preparados no terminal antes de criar stash; arquivos preservados.".to_owned())?;
        let entries = crate::scm::all_visible(root)?;
        if entries.is_empty() {
            return Err("Nenhuma alteração visível para guardar. Dependências e ignorados permanecem no disco.".into());
        }
        for e in entries {
            if e["conflict"] == true {
                return Err("Resolva os conflitos antes de criar stash.".into());
            }
            for key in ["path", "oldPath"] {
                if let Some(path) = e[key].as_str() {
                    Backend::path(root, path, false)?;
                }
            }
        }
        // A positive exact pathspec for a staged deletion/rename can fail inside
        // Git's cleanup after already creating the stash. Scope the complete,
        // admitted projection via exclusions instead, including tracked ignores.
        let ignored = git_ok(root, &["ls-files", "-ci", "--exclude-standard", "-z"])?;
        let mut excluded = Vec::new();
        for path in ignored.split(|b| *b == 0).filter(|p| !p.is_empty()) {
            excluded.push(
                std::str::from_utf8(path)
                    .map_err(|_| "Caminho ignorado não é UTF-8; use o terminal.")?,
            );
            if excluded.len() > 2000 || ignored.len() > 1024 * 1024 {
                return Err("Lista de ignorados do índice volumosa; stash não iniciado.".into());
            }
        }
        let mut spec = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
        spec.write_all(b".\0:(icase,glob,exclude)**/node_modules/**\0:(icase,glob,exclude)**/node_modules\0:(icase,exclude)node_modules\0").map_err(|e| e.to_string())?;
        for path in excluded {
            spec.write_all(format!(":(literal,exclude){path}\0").as_bytes())
                .map_err(|e| e.to_string())?;
        }
        spec.flush().map_err(|e| e.to_string())?;
        let arg = format!(
            "--pathspec-from-file={}",
            crate::backend::friendly(spec.path())
        );
        return Ok(
            json!({"output":output(root, &["stash", "push", "-u", "-m", message, &arg, "--pathspec-file-nul"])?}),
        );
    }
    let oid = strarg(p, "oid")?;
    let reference = selector(root, oid)?;
    match method {
        "git_stash_files" => Ok(json!({"paths":files(root, oid)?})),
        "git_stash_diff" => {
            let path = strarg(p, "path")?;
            if !files(root, oid)?.iter().any(|p| p == path) {
                return Err("Arquivo não pertence a este stash.".into());
            }
            Backend::path(root, path, false)?;
            let original = text_file(&blob(root, &format!("{oid}^1:{path}"))?)?.0;
            let mut modified = blob(root, &format!("{oid}:{path}"))?;
            if modified.is_empty() {
                // A stash with -u has a third parent. Missing third parent is normal.
                let parent = git(root, &["rev-parse", "--verify", &format!("{oid}^3")])?;
                if parent.status.success() {
                    modified = blob(root, &format!("{oid}^3:{path}"))?;
                }
            }
            let modified = text_file(&modified)?.0;
            crate::performance::validate_diff(&original)?;
            crate::performance::validate_diff(&modified)?;
            Ok(json!({"original":original,"modified":modified}))
        }
        "git_stash_show" => {
            let bytes = git_ok(root, &["stash", "show", "-p", "--include-untracked", oid])?;
            let text = String::from_utf8_lossy(&bytes);
            crate::performance::validate_diff(&text)?;
            Ok(json!({"output":text}))
        }
        "git_stash_apply" => Ok(json!({"output":output(root, &["stash", "apply", oid])?})),
        "git_stash_drop" => Ok(json!({"output":output(root, &["stash", "drop", &reference])?})),
        _ => Err("Operação de stash desconhecida.".into()),
    }
}
