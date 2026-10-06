//! Bounded SCM projection, separate from destructive actions and full Git truth.
use crate::backend::{Backend, Result, friendly, git, parse_status};
use serde_json::{Value, json};
use std::{collections::HashSet, io::Write, path::Path, process::Stdio};
pub const LIMIT: usize = 2000;
pub fn dependency(path: &str) -> bool {
    path.replace('\\', "/")
        .split('/')
        .any(|c| c.eq_ignore_ascii_case("node_modules"))
}
pub fn ignored(root: &Path, paths: &[String]) -> Result<HashSet<String>> {
    if paths.is_empty() {
        return Ok(HashSet::new());
    }
    if paths.len() > 4096 || paths.iter().map(String::len).sum::<usize>() > 1024 * 1024 {
        return Err("Escopo de ignore grande demais; operação não realizada.".into());
    }
    let mut child = crate::backend::hidden_command("git")
        .args(["check-ignore", "--no-index", "-z", "--stdin"])
        .current_dir(friendly(root))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let mut stdin = child.stdin.take().unwrap();
    let input = paths.join("\0") + "\0";
    let writer = std::thread::spawn(move || {
        let _ = stdin.write_all(input.as_bytes());
    });
    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    let _ = writer.join();
    if !output.status.success() && output.status.code() != Some(1) {
        return Err(
            "Git não conseguiu confirmar regras de ignore; lista preservada, ações interrompidas."
                .into(),
        );
    }
    Ok(output
        .stdout
        .split(|b| *b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| String::from_utf8_lossy(p).into_owned())
        .collect())
}
pub fn status(root: &Path, directory: Option<&str>) -> Result<Value> {
    let scope = directory
        .map(|p| format!(":(literal){p}"))
        .unwrap_or(".".into());
    let mode = if directory.is_some() {
        "--untracked-files=all"
    } else {
        "--untracked-files=normal"
    };
    // Override the legacy literal flag only for controlled pathspecs. User paths
    // remain :(literal), never glob/magic or shell-interpolated.
    let output = git(
        root,
        &[
            "--no-literal-pathspecs",
            "status",
            "--porcelain=v1",
            "-z",
            "--branch",
            mode,
            "--",
            &scope,
            ":(glob,exclude)**/node_modules/**",
            ":(glob,exclude)**/node_modules",
            ":(exclude)node_modules",
        ],
    )?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().into());
    }
    let mut bytes = output.stdout;
    let mut partial = bytes.len() > 8 * 1024 * 1024;
    if partial {
        bytes.truncate(bytes.iter().rposition(|b| *b == 0).unwrap_or(0) + 1);
    }
    // Cut at record boundaries BEFORE JSON allocation. Rename needs its old path.
    let mut count = 0;
    let mut end = 0;
    let mut rename = false;
    let mut record_start = 0;
    for part in bytes.split_inclusive(|b| *b == 0) {
        if part.last() != Some(&0) {
            partial = true;
            break;
        }
        if !rename && !part.starts_with(b"## ") {
            record_start = end;
            if count >= LIMIT {
                partial = true;
                break;
            }
            count += 1;
            rename = part.len() >= 4
                && (matches!(part[0], b'R' | b'C') || matches!(part[1], b'R' | b'C'));
        } else if rename {
            rename = false;
        }
        end += part.len();
    }
    if rename {
        partial = true;
        end = record_start;
    }
    let mut value = parse_status(&bytes[..end]);
    let entries = value["entries"].as_array().unwrap();
    let paths = entries
        .iter()
        .flat_map(|e| [e["path"].as_str(), e["oldPath"].as_str()])
        .flatten()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let excluded = ignored(root, &paths)?;
    let mut filtered = 0;
    let entries = entries
        .iter()
        .filter_map(|e| {
            let path = e["path"].as_str().unwrap();
            // Keep conflicts visible even if ignore rules were later changed.
            if e["conflict"] != true
                && (dependency(path)
                    || excluded.contains(path)
                    || e["oldPath"]
                        .as_str()
                        .is_some_and(|p| dependency(p) || excluded.contains(p)))
            {
                filtered += 1;
                return None;
            }
            let mut e = e.clone();
            e["directory"] = json!(e["x"] == "?" && path.ends_with('/'));
            Some(e)
        })
        .collect::<Vec<_>>();
    value["entries"] = json!(entries);
    value["partial"] = json!(partial);
    value["filtered"] = json!(filtered);
    value["limit"] = json!(LIMIT);
    value["groups"] = json!(
        value["entries"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|e| e["directory"] == true)
            .count()
    );
    Ok(value)
}
pub fn all_visible(root: &Path) -> Result<Vec<Value>> {
    let status = status(root, None)?;
    if status["partial"] == true {
        return Err("Lista Git parcial. Ações em todos foram bloqueadas; selecione arquivos individualmente.".into());
    }
    let mut entries = Vec::new();
    for e in status["entries"].as_array().unwrap() {
        if e["directory"] == true {
            let group = status_for_group(root, e["path"].as_str().unwrap())?;
            if group["partial"] == true {
                return Err("Pasta com alterações demais; ação em todos bloqueada.".into());
            }
            entries.extend(group["entries"].as_array().unwrap().iter().cloned());
        } else {
            entries.push(e.clone());
        }
        if entries.len() > 200 {
            return Err("Ações em todos limitadas a 200 arquivos por segurança/desempenho. Use ações individuais ou o Git no terminal.".into());
        }
    }
    Ok(entries)
}
pub fn status_for_group(root: &Path, path: &str) -> Result<Value> {
    Backend::path(root, path, true)?;
    if dependency(path) {
        return Err("Dependências node_modules não entram no controle de versão da IDE.".into());
    }
    status(root, Some(path))
}
pub fn guard_commit(root: &Path) -> Result<()> {
    // Check both sides of staged renames; an ignored old name must not disappear
    // from admission just because its new name is visible.
    let bytes = crate::backend::git_ok(root, &["diff", "--cached", "--name-only", "--no-renames", "-z"])?;
    let paths = bytes
        .split(|b| *b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| String::from_utf8_lossy(p).into_owned())
        .collect::<Vec<_>>();
    if paths.len() > LIMIT {
        return Err(
            "Índice Git volumoso; confira o commit pelo terminal antes de prosseguir.".into(),
        );
    }
    let excluded = ignored(root, &paths)?;
    if paths.iter().any(|p| dependency(p) || excluded.contains(p)) {
        return Err("O índice contém node_modules/arquivos ignorados ocultos na IDE. Retire-os pelo Git antes do commit; nada foi desfeito automaticamente.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn run(root: &Path, args: &[&str]) {
        assert!(git(root, args).unwrap().status.success());
    }
    #[test]
    #[ignore = "Requires scripts/generate-performance-fixture.mjs; reads isolated 42k-file fixture only"]
    fn large_fixture_projection_benchmark() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join(".validation/v061-large")
            .canonicalize()
            .unwrap();
        let start = std::time::Instant::now();
        let baseline = git(
            &root,
            &[
                "status",
                "--porcelain=v1",
                "-z",
                "--branch",
                "--untracked-files=all",
            ],
        )
        .unwrap();
        let baseline_ms = start.elapsed().as_millis();
        let baseline_entries = parse_status(&baseline.stdout)["entries"]
            .as_array()
            .unwrap()
            .len();
        let start = std::time::Instant::now();
        let bounded = status(&root, None).unwrap();
        let elapsed = start.elapsed().as_millis();
        let payload = serde_json::to_vec(&bounded).unwrap().len();
        assert!(baseline_entries >= 42000);
        assert!(bounded["entries"].as_array().unwrap().len() < 20);
        assert!(
            bounded["entries"]
                .as_array()
                .unwrap()
                .iter()
                .all(|e| !dependency(e["path"].as_str().unwrap()))
        );
        println!(
            "SCM fixture baseline_entries={baseline_entries}, baseline_bytes={}, baseline_ms={baseline_ms}; bounded_entries={}, bounded_json_bytes={payload}, bounded_ms={elapsed}",
            baseline.stdout.len(),
            bounded["entries"].as_array().unwrap().len()
        );
    }
    #[test]
    fn ignored_dependencies_groups_and_safe_bulk() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        run(&root, &["init"]);
        run(&root, &["config", "user.name", "Test"]);
        run(&root, &["config", "user.email", "test@example.invalid"]);
        std::fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        std::fs::write(root.join("node_modules/pkg/a.js"), "module").unwrap();
        std::fs::write(root.join("tracked.log"), "tracked").unwrap();
        run(&root, &["add", "-A"]);
        run(&root, &["commit", "-m", "fixture"]);
        std::fs::write(root.join(".gitignore"), "*.log\nsecret/\n").unwrap();
        std::fs::write(root.join("tracked.log"), "changed").unwrap();
        std::fs::write(root.join("node_modules/pkg/a.js"), "changed").unwrap();
        std::fs::create_dir_all(root.join("src/node_modules/pkg")).unwrap();
        std::fs::write(root.join("src/node_modules/pkg/b.js"), "hidden").unwrap();
        std::fs::write(root.join("src/code.ts"), "code").unwrap();
        let status = status(&root, None).unwrap();
        assert!(
            !status["entries"]
                .as_array()
                .unwrap()
                .iter()
                .any(|e| dependency(e["path"].as_str().unwrap()) || e["path"] == "tracked.log")
        );
        assert!(
            status["entries"]
                .as_array()
                .unwrap()
                .iter()
                .any(|e| e["directory"] == true)
        );
        let visible = all_visible(&root).unwrap();
        assert!(visible.iter().any(|e| e["path"] == "src/code.ts"));
        assert!(
            !visible
                .iter()
                .any(|e| dependency(e["path"].as_str().unwrap()))
        );
        run(&root, &["add", "-A"]);
        assert!(guard_commit(&root).is_err());
    }
    #[test]
    fn bulk_actions_preserve_hidden_files_and_individual_ignore_is_rejected() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        run(&root, &["init"]);
        std::fs::write(root.join(".gitignore"), "*.log\n").unwrap();
        std::fs::write(root.join("a.ts"), "source").unwrap();
        std::fs::write(root.join("hidden.log"), "private").unwrap();
        std::fs::create_dir(root.join("node_modules")).unwrap();
        std::fs::write(root.join("node_modules/a.js"), "dependency").unwrap();
        let b = Backend::fixture(&root);
        let mut p = json!({"root":friendly(&root),"action":"stage_all"});
        b.handle("git_action", &p).unwrap();
        let staged = crate::backend::git_ok(&root, &["diff", "--cached", "--name-only"]).unwrap();
        let staged = String::from_utf8(staged).unwrap();
        assert!(staged.contains("a.ts"));
        assert!(!staged.contains("node_modules"));
        assert!(!staged.contains("hidden.log"));
        p["action"] = json!("stage");
        p["path"] = json!("hidden.log");
        assert!(b.handle("git_action", &p).is_err());
        p["action"] = json!("unstage_all");
        p["path"] = json!("");
        b.handle("git_action", &p).unwrap();
        assert!(
            crate::backend::git_ok(&root, &["diff", "--cached", "--name-only"])
                .unwrap()
                .is_empty()
        );
        assert!(root.join("hidden.log").exists());
        assert!(root.join("node_modules/a.js").exists());
    }
    #[test]
    fn thousands_of_visible_changes_are_bounded_and_bulk_blocked() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        run(&root, &["init"]);
        std::fs::create_dir(root.join("src")).unwrap();
        for i in 0..2100 {
            std::fs::write(root.join(format!("src/f{i}.ts")), "source").unwrap();
        }
        let compact = status(&root, None).unwrap();
        assert_eq!(compact["entries"].as_array().unwrap().len(), 1);
        let expanded = status_for_group(&root, "src/").unwrap();
        assert_eq!(expanded["entries"].as_array().unwrap().len(), LIMIT);
        assert_eq!(expanded["partial"], true);
        assert!(all_visible(&root).is_err());
    }
}
