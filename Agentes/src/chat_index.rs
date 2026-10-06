//! On-demand, RAM-only retrieval. Metadata speeds reconciliation; every returned
//! hit is reread/hashed. Syntax relations are candidates, never compiler facts.
use crate::backend::{Backend, Result, hash};
use crate::chat_context::excluded;
use ignore::WalkBuilder;
use rusqlite::{Connection, params};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    io::Read,
    path::Path,
    time::{Instant, SystemTime},
};

const MAX_FILE: usize = 512 * 1024;
const MAX_BYTES: usize = 12 * 1024 * 1024;
#[derive(Clone)]
struct File {
    len: u64,
    modified: Option<SystemTime>,
    digest: String,
    units: Vec<Value>,
    errors: bool,
}
pub struct Index {
    db: Connection,
    files: BTreeMap<String, File>,
    generation: u64,
    syntax_bytes: usize,
}
fn text(root: &Path, path: &str) -> Result<String> {
    let path = Backend::path(root, path, true)?;
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(MAX_FILE as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > MAX_FILE || bytes.contains(&0) {
        return Err("Large/binary file excluded".into());
    }
    String::from_utf8(bytes).map_err(|_| "Not UTF-8".into())
}
fn syntax(path: &str, source: &str) -> (Vec<Value>, bool) {
    let ext = Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let language: tree_sitter::Language = match ext {
        "ts" => tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
        "tsx" => tree_sitter_typescript::LANGUAGE_TSX.into(),
        "js" | "jsx" | "mjs" | "cjs" => tree_sitter_javascript::LANGUAGE.into(),
        "cs" => tree_sitter_c_sharp::LANGUAGE.into(),
        "rs" => tree_sitter_rust::LANGUAGE.into(),
        _ => return (Vec::new(), false),
    };
    let mut parser = tree_sitter::Parser::new();
    if parser.set_language(&language).is_err() {
        return (Vec::new(), true);
    }
    #[allow(deprecated)]
    parser.set_timeout_micros(50000);
    let Some(tree) = parser.parse(source, None) else {
        return (Vec::new(), true);
    };
    let mut stack = vec![tree.root_node()];
    let mut units = Vec::new();
    while let Some(node) = stack.pop() {
        if units.len() >= 256 {
            break;
        }
        if matches!(
            node.kind(),
            "function_item"
                | "function_declaration"
                | "method_definition"
                | "method_declaration"
                | "constructor_declaration"
                | "class_declaration"
                | "interface_declaration"
                | "struct_item"
                | "impl_item"
                | "arrow_function"
        ) {
            let name = node
                .child_by_field_name("name")
                .or_else(|| node.parent().and_then(|p| p.child_by_field_name("name")))
                .and_then(|n| n.utf8_text(source.as_bytes()).ok())
                .unwrap_or(node.kind());
            let mut refs = HashSet::new();
            let mut descendants = vec![node];
            let mut visited = 0;
            while let Some(child) = descendants.pop() {
                visited += 1;
                if visited > 3000 || refs.len() >= 32 {
                    break;
                }
                if matches!(child.kind(), "identifier" | "type_identifier") {
                    if let Ok(s) = child.utf8_text(source.as_bytes()) {
                        if s.len() >= 3 && s.len() <= 80 && s != name {
                            refs.insert(s.to_string());
                        }
                    }
                }
                let mut cursor = child.walk();
                descendants.extend(child.named_children(&mut cursor));
            }
            let mut refs = refs.into_iter().collect::<Vec<_>>();
            refs.sort();
            units.push(json!({"name":name,"kind":node.kind(),"startLine":node.start_position().row+1,"endLine":node.end_position().row+1,"references":refs}));
        }
        let mut cursor = node.walk();
        stack.extend(node.named_children(&mut cursor));
    }
    (units, tree.root_node().has_error())
}
impl Index {
    pub fn new() -> Result<Self> {
        let db = Connection::open_in_memory().map_err(|e| e.to_string())?;
        db.execute_batch("PRAGMA temp_store=MEMORY; PRAGMA cache_size=-4096; CREATE VIRTUAL TABLE files USING fts5(path, symbols, body, tokenize='unicode61');").map_err(|e|e.to_string())?;
        Ok(Self {
            db,
            files: BTreeMap::new(),
            generation: 0,
            syntax_bytes: 0,
        })
    }
    fn remove(&mut self, path: &str) -> Result<()> {
        self.db
            .execute("DELETE FROM files WHERE path=?1", [path])
            .map_err(|e| e.to_string())?;
        if let Some(file) = self.files.remove(path) {
            self.syntax_bytes = self
                .syntax_bytes
                .saturating_sub(serde_json::to_string(&file.units).unwrap_or_default().len());
        }
        self.generation += 1;
        Ok(())
    }
    fn update(&mut self, path: &str, source: &str, meta: &fs::Metadata) -> Result<()> {
        self.remove(path)?;
        let (mut units, mut errors) = syntax(path, source);
        let size = serde_json::to_string(&units).unwrap_or_default().len();
        if self.syntax_bytes.saturating_add(size) > 4 * 1024 * 1024 {
            units.clear();
            errors = true;
        }
        self.syntax_bytes += serde_json::to_string(&units).unwrap_or_default().len();
        let symbols = units
            .iter()
            .filter_map(|u| u["name"].as_str())
            .collect::<Vec<_>>()
            .join(" ");
        self.db
            .execute(
                "INSERT INTO files(path,symbols,body) VALUES(?1,?2,?3)",
                params![path, symbols, source],
            )
            .map_err(|e| e.to_string())?;
        self.files.insert(
            path.into(),
            File {
                len: meta.len(),
                modified: meta.modified().ok(),
                digest: hash(source.as_bytes()),
                units,
                errors,
            },
        );
        Ok(())
    }
    pub fn search(&mut self, root: &Path, args: &Value, package: bool) -> Result<Value> {
        let query = args["query"].as_str().ok_or("Query required")?;
        if query.len() > 512 {
            return Err("Consulta excede 512 bytes".into());
        }
        let terms: Vec<_> = query
            .split(|c: char| !c.is_alphanumeric() && c != '_')
            .filter(|s| s.chars().count() >= 2)
            .take(16)
            .map(str::to_lowercase)
            .collect();
        if terms.is_empty() {
            return Err("Use termos de arquivo, rota ou símbolo".into());
        }
        let prefix = args["pathPrefix"].as_str().unwrap_or("").replace('\\', "/");
        if !prefix.is_empty() {
            Backend::path(root, &prefix, false)?;
        }
        let started = Instant::now();
        let mut walk = WalkBuilder::new(root);
        walk.follow_links(false)
            .hidden(false)
            .parents(false)
            .git_global(false)
            .require_git(
                root.join(".git").exists() || root.join("speedcode-worktrees.json").is_file(),
            )
            .max_depth(Some(30));
        let filter_root = root.to_owned();
        let filter_prefix = prefix.clone();
        walk.filter_entry(move |entry| {
            entry.path().strip_prefix(&filter_root).is_ok_and(|p| {
                let rel = p.to_string_lossy().replace('\\', "/");
                !excluded(p)
                    && (filter_prefix.is_empty()
                        || rel.is_empty()
                        || rel == filter_prefix
                        || rel.starts_with(&format!("{filter_prefix}/"))
                        || filter_prefix.starts_with(&format!("{rel}/")))
            })
        });
        let (mut scanned, mut read_bytes, mut reused, mut skipped, mut complete) =
            (0usize, 0usize, 0usize, 0usize, true);
        let mut inventory = HashSet::new();
        let mut retained = 0usize;
        for entry in walk.build() {
            if scanned >= 6000 || started.elapsed().as_millis() > 1200 {
                complete = false;
                break;
            }
            let entry = match entry {
                Ok(v) => v,
                Err(_) => {
                    skipped += 1;
                    complete = false;
                    continue;
                }
            };
            if entry.depth() >= 30 && entry.file_type().is_some_and(|t| t.is_dir()) {
                complete = false;
            }
            if !entry.file_type().is_some_and(|t| t.is_file()) {
                continue;
            }
            let path = entry
                .path()
                .strip_prefix(root)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            scanned += 1;
            let meta = match Backend::path(root, &path, true)
                .and_then(|p| fs::metadata(p).map_err(|e| e.to_string()))
            {
                Ok(v) => v,
                Err(_) => {
                    skipped += 1;
                    complete = false;
                    continue;
                }
            };
            if meta.len() > MAX_FILE as u64
                || retained.saturating_add(meta.len() as usize) > MAX_BYTES
            {
                skipped += 1;
                complete = false;
                self.remove(&path)?;
                continue;
            }
            retained += meta.len() as usize;
            inventory.insert(path.clone());
            let unchanged = self.files.get(&path).is_some_and(|f| {
                f.len == meta.len() && f.modified.is_some() && f.modified == meta.modified().ok()
            });
            if unchanged {
                reused += 1;
                continue;
            }
            match text(root, &path) {
                Ok(source) => {
                    read_bytes += source.len();
                    self.update(&path, &source, &meta)?;
                }
                Err(_) => {
                    skipped += 1;
                    complete = false;
                    self.remove(&path)?;
                }
            }
        }
        // Evict entries outside this eligible inventory even on partial walks.
        // Missing entries stay explicitly outside coverage, never stale evidence.
        let removed: Vec<_> = self
            .files
            .keys()
            .filter(|p| !inventory.contains(*p))
            .cloned()
            .collect();
        for path in removed {
            self.remove(&path)?;
        }
        let fts = terms
            .iter()
            .map(|t| format!("\"{}\"*", t.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" OR ");
        let mut candidates: Vec<String> = {
            let mut stmt=self.db.prepare("SELECT path FROM files WHERE files MATCH ?1 AND (?2='' OR path=?2 OR substr(path,1,length(?2)+1)=?2||'/') ORDER BY bm25(files,8.0,5.0,1.0),path LIMIT 80").map_err(|e|e.to_string())?;
            stmt.query_map(params![fts, prefix], |r| r.get(0))
                .map_err(|e| e.to_string())?
                .collect::<std::result::Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        };
        candidates
            .retain(|p| prefix.is_empty() || p == &prefix || p.starts_with(&format!("{prefix}/")));
        if package {
            // Project evidence is NOT executed or promoted to system instructions.
            let seeds = candidates.iter().take(4).cloned().collect::<Vec<_>>();
            let references: HashSet<String> = seeds
                .iter()
                .filter_map(|s| self.files.get(s))
                .flat_map(|f| &f.units)
                .flat_map(|u| u["references"].as_array().into_iter().flatten())
                .filter_map(|v| v.as_str())
                .map(str::to_owned)
                .collect();
            let mut related = self
                .files
                .iter()
                .filter(|(p, f)| {
                    !seeds.contains(p)
                        && f.units
                            .iter()
                            .any(|u| u["name"].as_str().is_some_and(|n| references.contains(n)))
                })
                .map(|(p, _)| p.clone())
                .collect::<Vec<_>>();
            related.sort();
            for path in related.into_iter().take(6).rev() {
                if !candidates.contains(&path) {
                    candidates.insert(seeds.len().min(candidates.len()), path);
                }
            }
            let mut additions = Vec::new();
            for path in self.files.keys() {
                let base = Path::new(path)
                    .file_name()
                    .and_then(|x| x.to_str())
                    .unwrap_or("");
                let ancestor = seeds.iter().any(|s| {
                    Path::new(s)
                        .ancestors()
                        .any(|a| a == Path::new(path).parent().unwrap_or(Path::new("")))
                });
                let instruction = base == "AGENTS.md" && ancestor;
                let config =
                    matches!(base, "package.json" | "Cargo.toml" | "tsconfig.json") && ancestor;
                if instruction || config {
                    additions.push(path.clone());
                }
            }
            additions.sort();
            for path in additions.into_iter().rev() {
                if !candidates.contains(&path) {
                    candidates.insert(0, path);
                }
            }
        }
        let limit = args["limit"]
            .as_u64()
            .unwrap_or(if package { 12 } else { 8 })
            .clamp(1, 20) as usize;
        let budget = args["budgetChars"]
            .as_u64()
            .unwrap_or(if package { 20000 } else { 12000 })
            .clamp(2000, 32000) as usize;
        let mut results = Vec::new();
        let mut used = 0;
        let mut verified_bytes = 0;
        let matching = candidates.len();
        for path in candidates.into_iter().take(limit) {
            let source = match text(root, &path) {
                Ok(v) => v,
                Err(_) => {
                    complete = false;
                    self.remove(&path)?;
                    continue;
                }
            };
            verified_bytes += source.len();
            if hash(source.as_bytes()) != self.files[&path].digest {
                complete = false;
                let meta = fs::metadata(root.join(&path)).map_err(|e| e.to_string())?;
                self.update(&path, &source, &meta)?;
            }
            let file = &self.files[&path];
            let lines: Vec<_> = source.lines().collect();
            let matched = lines
                .iter()
                .position(|l| terms.iter().any(|t| l.to_lowercase().contains(t)))
                .unwrap_or(0);
            let unit = file
                .units
                .iter()
                .filter(|u| {
                    u["startLine"].as_u64().unwrap_or(1) <= matched as u64 + 1
                        && u["endLine"].as_u64().unwrap_or(0) > matched as u64
                })
                .min_by_key(|u| {
                    u["endLine"].as_u64().unwrap_or(0) - u["startLine"].as_u64().unwrap_or(1)
                });
            let (first, end, structural) = if package {
                if let Some(u) = unit {
                    let first = u["startLine"].as_u64().unwrap() as usize - 1;
                    let end = u["endLine"].as_u64().unwrap() as usize;
                    if end - first <= 200 {
                        (first, end.min(lines.len()), true)
                    } else {
                        (
                            matched.saturating_sub(3),
                            (matched + 8).min(lines.len()),
                            false,
                        )
                    }
                } else if source.len() <= 4000 {
                    (0, lines.len(), false)
                } else {
                    (
                        matched.saturating_sub(3),
                        (matched + 8).min(lines.len()),
                        false,
                    )
                }
            } else {
                (
                    matched.saturating_sub(2),
                    (matched + 4).min(lines.len()),
                    false,
                )
            };
            let snippet = lines[first..end].join("\n");
            let max = if package { 12000 } else { 1600 };
            if snippet.chars().count() > max || used + snippet.len() > budget {
                complete = false;
                continue;
            }
            let imports = lines
                .iter()
                .enumerate()
                .filter(|(_, l)| {
                    let l = l.trim_start();
                    l.starts_with("import ")
                        || l.starts_with("using ")
                        || l.starts_with("use ")
                        || l.starts_with("mod ")
                })
                .take(20)
                .map(|(i, l)| json!({"line":i+1,"text":l.chars().take(300).collect::<String>()}))
                .collect::<Vec<_>>();
            let value = json!({"path":path,"startLine":first+1,"endLine":end,"contentHash":file.digest,"snippet":snippet,"truncated":first>0||end<lines.len(),"unitComplete":structural,"parseErrors":file.errors,"symbols":file.units.iter().take(12).cloned().collect::<Vec<_>>(),"imports":imports,"reason":if structural{"syntax-unit"}else{"lexical/project-evidence"}});
            let size = value.to_string().len();
            if used + size > budget {
                complete = false;
                continue;
            }
            used += size;
            results.push(value);
        }
        Ok(
            json!({"query":query,"results":results,"generation":self.generation,"truncated":matching>results.len(),"scannedFiles":scanned,"bytesRead":read_bytes,"verifiedBytes":verified_bytes,"cacheHits":reused,"indexedFiles":self.files.len(),"elapsedMs":started.elapsed().as_millis(),"engine":"sqlite-fts5-bm25+tree-sitter","package":package,"coverage":{"complete":complete,"skippedFiles":skipped,"scope":"Eligible saved UTF-8 files <=512 KiB, 12 MiB text budget, gitignore/exclusions; syntax candidates not semantic resolution","warning":"Always expand dependencies/tests/instructions. Partial results or absence never prove absence. Returned files are freshly hashed."}}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn incremental_index_detects_edits_deletes_exclusions_and_units() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        fs::write(
            root.join("Users.cs"),
            "class Users { public string GetUser() { return \"users\"; } }",
        )
        .unwrap();
        fs::write(root.join("AGENTS.md"), "Never remove tests").unwrap();
        fs::write(root.join(".env"), "users secret").unwrap();
        let mut index = Index::new().unwrap();
        let args = json!({"query":"users"});
        let cold = index.search(&root, &args, false).unwrap();
        assert_eq!(cold["results"][0]["path"], "Users.cs");
        assert!(cold["bytesRead"].as_u64().unwrap() > 0);
        let hot = index.search(&root, &args, false).unwrap();
        assert_eq!(hot["bytesRead"], 0);
        assert!(hot["verifiedBytes"].as_u64().unwrap() > 0);
        let pack = index.search(&root, &args, true).unwrap();
        assert!(
            pack["results"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["path"] == "AGENTS.md")
        );
        assert!(
            pack["results"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["unitComplete"] == true)
        );
        fs::write(
            root.join("Users.cs"),
            "class People { public string GetPerson() { return \"people\"; } }",
        )
        .unwrap();
        let changed = index
            .search(&root, &json!({"query":"people"}), false)
            .unwrap();
        assert_ne!(
            changed["results"][0]["contentHash"],
            cold["results"][0]["contentHash"]
        );
        fs::remove_file(root.join("Users.cs")).unwrap();
        assert!(
            index.search(&root, &args, false).unwrap()["results"]
                .as_array()
                .unwrap()
                .is_empty()
        );
        assert!(
            index
                .search(&root, &json!({"query":"users","pathPrefix":"../"}), false)
                .is_err()
        );
    }
    #[test]
    fn context_relations_tests_prefix_and_same_metadata_freshness() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        fs::create_dir(root.join("src")).unwrap();
        fs::write(root.join("src/UsersController.cs"),"using Domain;\nclass UsersController { UserService service; public UserDto GetUser() { return service.Find(); } }").unwrap();
        fs::write(
            root.join("src/UserService.cs"),
            "class UserService { public UserDto Find() { return new UserDto(); } }",
        )
        .unwrap();
        fs::write(
            root.join("src/UserDto.cs"),
            "class UserDto { public string Name; }",
        )
        .unwrap();
        fs::write(
            root.join("UsersTests.cs"),
            "class UsersTests { void Test() { var result = new UsersController().GetUser(); } }",
        )
        .unwrap();
        fs::write(root.join("AGENTS.md"), "Keep contracts and run tests").unwrap();
        let mut index = Index::new().unwrap();
        let pack = index
            .search(&root, &json!({"query":"GetUser"}), true)
            .unwrap();
        let results = pack["results"].as_array().unwrap();
        for path in [
            "src/UsersController.cs",
            "src/UserService.cs",
            "src/UserDto.cs",
            "UsersTests.cs",
            "AGENTS.md",
        ] {
            assert!(
                results.iter().any(|r| r["path"] == path),
                "Missing {path}: {pack}"
            );
        }
        let prefix = index
            .search(&root, &json!({"query":"GetUser","pathPrefix":"src"}), false)
            .unwrap();
        assert!(
            prefix["results"]
                .as_array()
                .unwrap()
                .iter()
                .all(|r| r["path"].as_str().unwrap().starts_with("src/"))
        );
        let old = fs::metadata(root.join("src/UserDto.cs"))
            .unwrap()
            .modified()
            .unwrap();
        fs::write(
            root.join("src/UserDto.cs"),
            "class UserDto { public string Code; }",
        )
        .unwrap();
        fs::File::options()
            .write(true)
            .open(root.join("src/UserDto.cs"))
            .unwrap()
            .set_times(fs::FileTimes::new().set_modified(old))
            .unwrap();
        let dto = index
            .search(&root, &json!({"query":"UserDto"}), true)
            .unwrap();
        assert!(
            dto["results"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["path"] == "src/UserDto.cs"
                    && r["snippet"].as_str().unwrap().contains("Code"))
        );
        fs::write(root.join(".gitignore"), "src/UserDto.cs\n").unwrap();
        let ignored = index
            .search(&root, &json!({"query":"UserDto"}), false)
            .unwrap();
        assert!(
            !ignored["results"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["path"] == "src/UserDto.cs")
        );
        fs::write(root.join("broken.ts"), "export function broken( { return ").unwrap();
        let broken = index
            .search(&root, &json!({"query":"broken"}), true)
            .unwrap();
        assert!(
            broken["results"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["path"] == "broken.ts" && r["parseErrors"] == true)
        );
    }
    #[test]
    fn offline_retrieval_benchmark() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        for i in 0..150 {
            fs::write(
                root.join(format!("service{i}.ts")),
                format!(
                    "export function endpoint{i}() {{ return 'route{i}'; }}\n{}",
                    "// support code\n".repeat(120)
                ),
            )
            .unwrap();
        }
        let mut index = Index::new().unwrap();
        let args = json!({"query":"endpoint73","limit":1});
        let cold = index.search(&root, &args, true).unwrap();
        let hot = index.search(&root, &args, true).unwrap();
        assert_eq!(cold["results"][0]["path"], "service73.ts");
        assert_eq!(hot["results"][0]["path"], "service73.ts");
        assert_eq!(hot["bytesRead"], 0);
        println!(
            "OFFLINE_SYNTHETIC cold={}ms/{}B hot={}ms/{}B verification={}B; not token/CPU/billing savings",
            cold["elapsedMs"],
            cold["bytesRead"],
            hot["elapsedMs"],
            hot["bytesRead"],
            hot["verifiedBytes"]
        );
    }
}
