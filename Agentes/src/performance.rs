//! Hard admission budgets. Never silently discard a file or retry a mutation.
use std::sync::{Arc, Mutex};
pub const REQUEST_BYTES: usize = 8 * 1024 * 1024;
pub const REQUESTS: usize = 32;
pub const IPC_IN_FLIGHT_BYTES: usize = 16 * 1024 * 1024;
pub const BROWSER_WINDOWS: usize = 2;
pub const CHAT_QUEUE_BYTES: usize = 8 * 1024 * 1024;
pub const CHAT_BATCH_BYTES: usize = 1024 * 1024;
pub const IMAGE_BYTES: u64 = 8 * 1024 * 1024;
pub const IMAGE_PIXELS: u64 = 8 * 1024 * 1024;
pub fn validate_diff(text: &str) -> Result<(), String> {
    if text.encode_utf16().take(512 * 1024 + 1).count() > 512 * 1024
        || text.lines().take(10001).count() > 10000
    {
        return Err("Diff excede 512 Ki caracteres/10.000 linhas por lado; use git diff no terminal. Arquivos preservados.".into());
    }
    Ok(())
}

#[derive(Default)]
pub struct RequestBudget(Mutex<(usize, usize)>);
pub struct Permit {
    budget: Arc<RequestBudget>,
    bytes: usize,
}
impl RequestBudget {
    pub fn reserve(self: &Arc<Self>, bytes: usize) -> Option<Permit> {
        let mut used = self.0.lock().unwrap();
        if bytes > REQUEST_BYTES || used.0 >= REQUESTS || used.1 + bytes > IPC_IN_FLIGHT_BYTES {
            return None;
        }
        used.0 += 1;
        used.1 += bytes;
        Some(Permit {
            budget: self.clone(),
            bytes,
        })
    }
}
impl Drop for Permit {
    fn drop(&mut self) {
        let mut used = self.budget.0.lock().unwrap();
        used.0 -= 1;
        used.1 -= self.bytes;
    }
}
impl std::fmt::Debug for Permit {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("IpcPermit").field(&self.bytes).finish()
    }
}
// Count encoded JSON without allocating a second full payload.
pub fn json_bytes(value: &serde_json::Value) -> usize {
    struct Counter(usize);
    impl std::io::Write for Counter {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0 += bytes.len();
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut counter = Counter(0);
    serde_json::to_writer(&mut counter, value).expect("JSON value serialization");
    counter.0
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn requests_bound_bytes_count_and_release_on_drop() {
        let b = Arc::new(RequestBudget::default());
        assert!(b.reserve(REQUEST_BYTES + 1).is_none());
        let first = b.reserve(REQUEST_BYTES).unwrap();
        let second = b.reserve(REQUEST_BYTES).unwrap();
        assert!(b.reserve(1).is_none());
        drop(first);
        drop(second);
        let permits: Vec<_> = (0..REQUESTS).map(|_| b.reserve(1).unwrap()).collect();
        assert!(b.reserve(1).is_none());
        drop(permits);
        assert!(b.reserve(REQUEST_BYTES).is_some());
    }
    #[test]
    fn byte_count_accounts_for_json_escaping_and_unicode() {
        let v = serde_json::json!({"text":"\0\n💡é"});
        assert_eq!(json_bytes(&v), v.to_string().len());
    }
    #[test]
    fn diff_budget_bounds_unicode_size_and_lines_before_ipc() {
        assert!(validate_diff("small\n").is_ok());
        assert!(validate_diff(&"x".repeat(512 * 1024 + 1)).is_err());
        assert!(validate_diff(&"💡".repeat(256 * 1024 + 1)).is_err());
        assert!(validate_diff(&"line\n".repeat(10001)).is_err());
    }
}
