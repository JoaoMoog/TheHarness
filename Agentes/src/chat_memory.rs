//! Only Copilot session-state I/O is virtualized; project edits remain real.
use crate::backend::{Backend, friendly};
use async_trait::async_trait;
use github_copilot_sdk::types::{DirEntry, DirEntryKind, FileInfo, FsError, SessionFsProvider};
use std::{collections::BTreeMap, path::PathBuf, sync::Mutex};

#[derive(Default)]
pub struct MemoryFs {
    data: Mutex<BTreeMap<String, Option<String>>>,
    workspace: Option<PathBuf>,
    references: Mutex<Vec<PathBuf>>,
}
fn key(path: &str) -> String {
    let path = path.replace('\\', "/");
    let path = path.strip_prefix("//?/").unwrap_or(&path);
    let mut parts = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            _ => parts.push(part),
        }
    }
    let prefix = if path.starts_with('/') { "/" } else { "" };
    let path = format!("{prefix}{}", parts.join("/"));
    if path.as_bytes().get(1) == Some(&b':') {
        path.to_lowercase()
    } else {
        path
    }
}
fn missing(path: &str) -> FsError {
    std::io::Error::new(
        std::io::ErrorKind::NotFound,
        format!("Session state not found: {path}"),
    )
    .into()
}
fn timestamp(t: std::io::Result<std::time::SystemTime>) -> String {
    time::OffsetDateTime::from(t.unwrap_or(std::time::UNIX_EPOCH))
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".into())
}
impl MemoryFs {
    pub fn for_workspace(root: &std::path::Path) -> Self {
        Self {
            workspace: Some(root.to_owned()),
            ..Self::default()
        }
    }
    pub fn set_references(&self, references: Vec<PathBuf>) {
        *self.references.lock().unwrap() = references;
    }
    // State is virtual; only the registered workspace is writable. Explicitly
    // attached external references are read-only. Never follow reparse points.
    fn native(&self, path: &str, write: bool) -> Result<Option<PathBuf>, FsError> {
        let Some(root) = &self.workspace else {
            return Ok(None);
        };
        let path = key(path);
        let state = key(r"C:\SpeedCodeSession");
        if path == state || path.starts_with(&format!("{state}/")) {
            return Ok(None);
        }
        let mut roots = vec![root.clone()];
        if !write {
            roots.extend(self.references.lock().unwrap().clone());
        }
        for root in roots {
            let base = key(&friendly(&root));
            if path == base || path.starts_with(&format!("{base}/")) {
                let relative = path[base.len()..].trim_start_matches('/');
                if write && relative.is_empty() {
                    return Err(std::io::Error::other("Cannot mutate workspace root").into());
                }
                return Backend::path(&root, relative, false)
                    .map(Some)
                    .map_err(|e| std::io::Error::other(e).into());
            }
        }
        Err(missing(&path))
    }
    fn store(&self, path: &str, text: &str, append: bool) -> Result<(), FsError> {
        let mut data = self.data.lock().unwrap();
        let path = key(path);
        let previous = if append {
            data.get(&path).and_then(|x| x.as_deref()).unwrap_or("")
        } else {
            ""
        };
        let size: usize = data
            .values()
            .filter_map(|x| x.as_ref())
            .map(String::len)
            .sum();
        let old_size = data
            .get(&path)
            .and_then(|s| s.as_ref())
            .map_or(0, String::len);
        if size
            .saturating_sub(old_size)
            .saturating_add(previous.len())
            .saturating_add(text.len())
            > 64 * 1024 * 1024
        {
            return Err(std::io::Error::other("Session memory limit: clear context").into());
        }
        let content = format!("{previous}{text}");
        for (i, _) in path.match_indices('/') {
            data.entry(path[..i].into()).or_insert(None);
        }
        data.insert(path, Some(content));
        Ok(())
    }
}
#[async_trait]
impl SessionFsProvider for MemoryFs {
    async fn read_file(&self, path: &str) -> Result<String, FsError> {
        if let Some(p) = self.native(path, false)? {
            if std::fs::metadata(&p)?.len() > 32 * 1024 * 1024 {
                return Err(std::io::Error::other("Reference exceeds 32 MiB").into());
            }
            return std::fs::read_to_string(p).map_err(Into::into);
        }
        self.data
            .lock()
            .unwrap()
            .get(&key(path))
            .and_then(Clone::clone)
            .ok_or_else(|| missing(path))
    }
    async fn write_file(&self, p: &str, c: &str, _: Option<i64>) -> Result<(), FsError> {
        if let Some(p) = self.native(p, true)? {
            return std::fs::write(p, c).map_err(Into::into);
        }
        self.store(p, c, false)
    }
    async fn append_file(&self, p: &str, c: &str, _: Option<i64>) -> Result<(), FsError> {
        if let Some(p) = self.native(p, true)? {
            use std::io::Write;
            return std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(p)?
                .write_all(c.as_bytes())
                .map_err(Into::into);
        }
        self.store(p, c, true)
    }
    async fn exists(&self, p: &str) -> Result<bool, FsError> {
        match self.native(p, false) {
            Ok(Some(p)) => return p.try_exists().map_err(Into::into),
            Err(e)
                if matches!(
                    e.kind(),
                    github_copilot_sdk::session_fs::FsErrorKind::NotFound(_)
                ) =>
            {
                return Ok(false);
            }
            Err(e) => return Err(e),
            _ => {}
        }
        Ok(self.data.lock().unwrap().contains_key(&key(p)))
    }
    async fn stat(&self, p: &str) -> Result<FileInfo, FsError> {
        if let Some(p) = self.native(p, false)? {
            let m = std::fs::metadata(p)?;
            return Ok(FileInfo::new(
                m.is_file(),
                m.is_dir(),
                m.len() as i64,
                timestamp(m.modified()),
                timestamp(m.created()),
            ));
        }
        let data = self.data.lock().unwrap();
        let v = data.get(&key(p)).ok_or_else(|| missing(p))?;
        Ok(FileInfo::new(
            v.is_some(),
            v.is_none(),
            v.as_ref().map_or(0, |s| s.len() as i64),
            "1970-01-01T00:00:00Z",
            "1970-01-01T00:00:00Z",
        ))
    }
    async fn mkdir(&self, p: &str, recursive: bool, _: Option<i64>) -> Result<(), FsError> {
        if let Some(p) = self.native(p, true)? {
            return if recursive {
                std::fs::create_dir_all(p)
            } else {
                std::fs::create_dir(p)
            }
            .map_err(Into::into);
        }
        let mut data = self.data.lock().unwrap();
        let p = key(p);
        for (i, _) in p.match_indices('/') {
            data.entry(p[..i].into()).or_insert(None);
        }
        data.entry(p).or_insert(None);
        Ok(())
    }
    async fn readdir(&self, p: &str) -> Result<Vec<String>, FsError> {
        Ok(self
            .readdir_with_types(p)
            .await?
            .into_iter()
            .map(|e| e.name)
            .collect())
    }
    async fn readdir_with_types(&self, p: &str) -> Result<Vec<DirEntry>, FsError> {
        if let Some(p) = self.native(p, false)? {
            return std::fs::read_dir(p)?
                .map(|e| {
                    let e = e?;
                    Ok(DirEntry::new(
                        e.file_name().to_string_lossy(),
                        if e.file_type()?.is_dir() {
                            DirEntryKind::Directory
                        } else {
                            DirEntryKind::File
                        },
                    ))
                })
                .collect();
        }
        if !self.data.lock().unwrap().contains_key(&key(p)) {
            return Err(missing(p));
        }
        let prefix = format!("{}/", key(p));
        Ok(self
            .data
            .lock()
            .unwrap()
            .iter()
            .filter_map(|(k, v)| {
                let tail = k.strip_prefix(&prefix)?;
                (!tail.contains('/') && !tail.is_empty()).then(|| {
                    DirEntry::new(
                        tail,
                        if v.is_some() {
                            DirEntryKind::File
                        } else {
                            DirEntryKind::Directory
                        },
                    )
                })
            })
            .collect())
    }
    async fn rm(&self, p: &str, recursive: bool, force: bool) -> Result<(), FsError> {
        if let Some(p) = self.native(p, true)? {
            let result = if p.is_dir() {
                if recursive {
                    std::fs::remove_dir_all(p)
                } else {
                    std::fs::remove_dir(p)
                }
            } else {
                std::fs::remove_file(p)
            };
            return match result {
                Err(e) if force && e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                other => other.map_err(Into::into),
            };
        }
        let mut data = self.data.lock().unwrap();
        let p = key(p);
        let prefix = format!("{p}/");
        if !force && !data.contains_key(&p) {
            return Err(missing(&p));
        }
        if !recursive && data.keys().any(|k| k.starts_with(&prefix)) {
            return Err(std::io::Error::other("Directory not empty").into());
        }
        data.retain(|k, _| k != &p && !(recursive && k.starts_with(&prefix)));
        Ok(())
    }
    async fn rename(&self, src: &str, dest: &str) -> Result<(), FsError> {
        match (self.native(src, true)?, self.native(dest, true)?) {
            (Some(src), Some(dest)) => return std::fs::rename(src, dest).map_err(Into::into),
            (None, None) => {}
            _ => {
                return Err(
                    std::io::Error::other("Cannot move across state/workspace boundaries").into(),
                );
            }
        }
        let mut data = self.data.lock().unwrap();
        let src = key(src);
        let dest = key(dest);
        if !data.contains_key(&src) {
            return Err(missing(&src));
        }
        let moved: Vec<_> = data
            .iter()
            .filter(|(k, _)| *k == &src || k.starts_with(&format!("{src}/")))
            .map(|(k, v)| (k.clone(), format!("{dest}{}", &k[src.len()..]), v.clone()))
            .collect();
        for (old, new, v) in moved {
            data.remove(&old);
            data.insert(new, v);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn session_state_is_memory_only() {
        let fs = MemoryFs::default();
        fs.write_file("/session/events.jsonl", "one", None)
            .await
            .unwrap();
        fs.append_file("/session/events.jsonl", "two", None)
            .await
            .unwrap();
        assert_eq!(
            fs.read_file("/session/events.jsonl").await.unwrap(),
            "onetwo"
        );
        assert_eq!(fs.readdir("/session").await.unwrap(), vec!["events.jsonl"]);
        fs.rename("/session", "/new").await.unwrap();
        assert!(!fs.exists("/session/events.jsonl").await.unwrap());
        fs.rm("/new", true, false).await.unwrap();
        assert!(!fs.exists("/new/events.jsonl").await.unwrap());
        assert!(!MemoryFs::default().exists("/session").await.unwrap());
    }
    #[tokio::test]
    async fn windows_state_paths_are_normalized() {
        let fs = MemoryFs::default();
        fs.write_file(r"C:\SpeedCodeSession\a\events.jsonl", "event", None)
            .await
            .unwrap();
        assert_eq!(
            fs.read_file(r"\\?\c:\speedcodesession\a\.\other\..\events.jsonl")
                .await
                .unwrap(),
            "event"
        );
        assert!(
            fs.stat(r"C:\SpeedCodeSession\a")
                .await
                .unwrap()
                .is_directory
        );
        fs.write_file(r"c:\speedcodesession\a\events.jsonl", "replacement", None)
            .await
            .unwrap();
        assert_eq!(
            fs.readdir(r"c:\SpeedCodeSession\a").await.unwrap(),
            vec!["events.jsonl"]
        );
    }
    #[tokio::test]
    async fn workspace_is_real_but_session_state_is_not() {
        let root = std::env::temp_dir().join(format!("speedcode-fs-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let root = root.canonicalize().unwrap();
        let fs = MemoryFs::for_workspace(&root);
        assert!(fs.stat(&friendly(&root)).await.unwrap().is_directory);
        let file = root.join("context.txt");
        fs.write_file(&friendly(&file), "real content", None)
            .await
            .unwrap();
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "real content");
        assert_eq!(
            fs.read_file(&friendly(&file)).await.unwrap(),
            "real content"
        );
        assert_ne!(
            fs.stat(&friendly(&file)).await.unwrap().mtime,
            "1970-01-01T00:00:00Z"
        );
        fs.write_file(r"C:\SpeedCodeSession\events.jsonl", "in memory", None)
            .await
            .unwrap();
        assert!(!root.join("events.jsonl").exists());
        assert!(
            fs.write_file(&format!("{}\\..\\escape.txt", friendly(&root)), "no", None)
                .await
                .is_err()
        );
        assert!(fs.rm(&friendly(&root), true, true).await.is_err());
        let reference =
            std::env::temp_dir().join(format!("speedcode-reference-{}.txt", std::process::id()));
        std::fs::write(&reference, "reference").unwrap();
        fs.set_references(vec![reference.clone()]);
        assert_eq!(
            fs.read_file(&friendly(&reference)).await.unwrap(),
            "reference"
        );
        assert!(
            fs.write_file(&friendly(&reference), "no", None)
                .await
                .is_err()
        );
        fs.set_references(vec![]);
        assert!(fs.read_file(&friendly(&reference)).await.is_err());
        fs.rm(&friendly(&file), false, false).await.unwrap();
        assert!(!file.exists());
        std::fs::remove_file(reference).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
}
