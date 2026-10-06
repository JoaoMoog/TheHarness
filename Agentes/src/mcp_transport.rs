//! Bound raw MCP messages before rmcp JSON/SSE parsing. No retry of a failed tool.
use futures::{StreamExt, stream::BoxStream};
use rmcp::{
    RoleClient,
    model::{ClientJsonRpcMessage, ServerJsonRpcMessage},
    transport::{
        Transport,
        async_rw::AsyncRwTransport,
        streamable_http_client::{
            SseError, StreamableHttpClient, StreamableHttpError, StreamableHttpPostResponse,
        },
    },
};
use std::{
    collections::HashMap,
    io,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
};
use tokio::io::{AsyncRead, ReadBuf};
pub const MESSAGE_BYTES: usize = 1024 * 1024;

pub struct LineBounded<R> {
    inner: R,
    count: usize,
    failed: bool,
}
impl<R> LineBounded<R> {
    pub fn new(inner: R) -> Self {
        Self {
            inner,
            count: 0,
            failed: false,
        }
    }
}
impl<R: AsyncRead + Unpin> AsyncRead for LineBounded<R> {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        out: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        if self.failed {
            return Poll::Ready(Err(io::Error::other(
                "MCP message exceeded 1 MiB; connection stopped",
            )));
        }
        if out.remaining() == 0 {
            return Poll::Ready(Ok(()));
        }
        let mut bytes = [0u8; 8192];
        let capacity = out.remaining().min(bytes.len());
        let mut read = ReadBuf::new(&mut bytes[..capacity]);
        match Pin::new(&mut self.inner).poll_read(cx, &mut read) {
            Poll::Pending => Poll::Pending,
            Poll::Ready(Err(e)) => Poll::Ready(Err(e)),
            Poll::Ready(Ok(())) => {
                for byte in read.filled() {
                    self.count += 1;
                    if self.count > MESSAGE_BYTES {
                        self.failed = true;
                        return Poll::Ready(Err(io::Error::other("MCP message exceeded 1 MiB")));
                    }
                    if *byte == b'\n' {
                        self.count = 0;
                    }
                }
                out.put_slice(read.filled());
                Poll::Ready(Ok(()))
            }
        }
    }
}
pub struct Stdio {
    inner: AsyncRwTransport<
        RoleClient,
        LineBounded<tokio::process::ChildStdout>,
        tokio::process::ChildStdin,
    >,
    child: Option<Box<dyn process_wrap::tokio::ChildWrapper>>,
}
impl Stdio {
    pub fn spawn(mut command: process_wrap::tokio::CommandWrap) -> io::Result<Self> {
        command
            .command_mut()
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null());
        let mut child = command.spawn()?;
        let stdout = child
            .inner_mut()
            .stdout()
            .take()
            .ok_or_else(|| io::Error::other("MCP stdout unavailable"))?;
        let stdin = child
            .inner_mut()
            .stdin()
            .take()
            .ok_or_else(|| io::Error::other("MCP stdin unavailable"))?;
        Ok(Self {
            inner: AsyncRwTransport::new(LineBounded::new(stdout), stdin),
            child: Some(child),
        })
    }
}
impl Drop for Stdio {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            tokio::spawn(async move {
                let _ = Box::into_pin(child.kill()).await;
            });
        }
    }
}
impl Transport<RoleClient> for Stdio {
    type Error = io::Error;
    fn send(
        &mut self,
        value: ClientJsonRpcMessage,
    ) -> impl Future<Output = io::Result<()>> + Send + 'static {
        self.inner.send(value)
    }
    fn receive(&mut self) -> impl Future<Output = Option<ServerJsonRpcMessage>> + Send {
        self.inner.receive()
    }
    async fn close(&mut self) -> io::Result<()> {
        self.inner.close().await?;
        if let Some(mut child) = self.child.take() {
            Box::into_pin(child.kill()).await?;
        }
        Ok(())
    }
}

#[derive(Default)]
struct SseBudget {
    bytes: usize,
    line: usize,
    cr: bool,
}
impl SseBudget {
    fn observe(&mut self, bytes: &[u8]) -> io::Result<()> {
        for b in bytes {
            self.bytes += 1;
            if self.bytes > MESSAGE_BYTES {
                return Err(io::Error::other("MCP SSE event exceeded 1 MiB"));
            }
            if *b == b'\n' && self.cr {
                self.cr = false;
                continue;
            }
            self.cr = *b == b'\r';
            if *b == b'\r' || *b == b'\n' {
                if self.line == 0 {
                    self.bytes = 0;
                }
                self.line = 0;
            } else {
                self.line += 1;
            }
        }
        Ok(())
    }
}
#[derive(Clone)]
pub struct Http(pub reqwest::Client);
type HttpError = StreamableHttpError<reqwest::Error>;
type Headers = HashMap<reqwest::header::HeaderName, reqwest::header::HeaderValue>;
impl StreamableHttpClient for Http {
    type Error = reqwest::Error;
    async fn post_message(
        &self,
        uri: Arc<str>,
        message: ClientJsonRpcMessage,
        session: Option<Arc<str>>,
        auth: Option<String>,
        headers: Headers,
    ) -> Result<StreamableHttpPostResponse, HttpError> {
        let mut request = self
            .0
            .post(uri.as_ref())
            .header("Accept", "application/json, text/event-stream");
        if let Some(auth) = auth {
            request = request.bearer_auth(auth);
        }
        for (name, value) in headers {
            if ["accept", "mcp-session-id", "last-event-id"].contains(&name.as_str()) {
                return Err(StreamableHttpError::ReservedHeaderConflict(
                    name.to_string(),
                ));
            }
            request = request.header(name, value);
        }
        if let Some(session) = &session {
            request = request.header("Mcp-Session-Id", session.as_ref());
        }
        let mut response = request.json(&message).send().await?;
        let status = response.status();
        if status.as_u16() == 202 || status.as_u16() == 204 {
            return Ok(StreamableHttpPostResponse::Accepted);
        }
        if status.as_u16() == 404 && session.is_some() {
            return Err(StreamableHttpError::SessionExpired);
        }
        let session = response
            .headers()
            .get("Mcp-Session-Id")
            .and_then(|h| h.to_str().ok())
            .map(String::from);
        let mime = response
            .headers()
            .get("Content-Type")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("")
            .to_owned();
        if status.is_success() && mime.starts_with("text/event-stream") {
            let stream = response.bytes_stream().scan(
                (SseBudget::default(), false),
                |(budget, failed), chunk| {
                    if *failed {
                        return std::future::ready(None);
                    }
                    let value = match chunk {
                        Ok(chunk) => budget.observe(&chunk).map(|_| chunk),
                        Err(e) => Err(io::Error::other(e)),
                    };
                    *failed = value.is_err();
                    std::future::ready(Some(value))
                },
            );
            return Ok(StreamableHttpPostResponse::Sse(
                sse_stream::SseStream::from_bytes_stream(stream).boxed(),
                session,
            ));
        }
        if response
            .content_length()
            .is_some_and(|n| n > MESSAGE_BYTES as u64)
        {
            return Err(io::Error::other("MCP HTTP response exceeded 1 MiB").into());
        }
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            if body.len() + chunk.len() > MESSAGE_BYTES {
                return Err(io::Error::other("MCP HTTP response exceeded 1 MiB").into());
            }
            body.extend_from_slice(&chunk);
        }
        if mime.starts_with("application/json") {
            if let Ok(message) = serde_json::from_slice(&body) {
                return Ok(StreamableHttpPostResponse::Json(message, session));
            }
        }
        if status.is_success() && !matches!(message, ClientJsonRpcMessage::Request(_)) {
            return Ok(StreamableHttpPostResponse::Accepted);
        }
        Err(StreamableHttpError::UnexpectedServerResponse(
            format!("MCP HTTP {status}: invalid JSON/unsupported content type (body omitted)")
                .into(),
        ))
    }
    async fn delete_session(
        &self,
        uri: Arc<str>,
        session: Arc<str>,
        auth: Option<String>,
        headers: Headers,
    ) -> Result<(), HttpError> {
        self.0.delete_session(uri, session, auth, headers).await
    }
    async fn get_stream(
        &self,
        uri: Arc<str>,
        session: Option<Arc<str>>,
        last: Option<String>,
        auth: Option<String>,
        headers: Headers,
    ) -> Result<BoxStream<'static, Result<sse_stream::Sse, SseError>>, HttpError> {
        self.0
            .get_stream_with_max_sse_event_size(uri, session, last, auth, headers, MESSAGE_BYTES)
            .await
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncReadExt;
    #[tokio::test]
    async fn stdio_limits_before_json_parse_and_resets_between_messages() {
        let input = vec![b'x'; MESSAGE_BYTES + 1];
        let mut reader = LineBounded::new(input.as_slice());
        let mut output = Vec::new();
        assert!(reader.read_to_end(&mut output).await.is_err());
        assert!(output.len() <= MESSAGE_BYTES);
        let input = b"abc\nxyz\n";
        let mut reader = LineBounded::new(input.as_slice());
        let mut output = Vec::new();
        reader.read_to_end(&mut output).await.unwrap();
        assert_eq!(output, input);
    }
    #[test]
    fn sse_counts_events_across_chunks_without_confusing_crlf_with_blank_line() {
        let mut budget = SseBudget::default();
        budget.observe(b"data: a\r").unwrap();
        budget.observe(b"\ndata: b\r\n").unwrap();
        assert!(budget.bytes > 0);
        budget.observe(b"\r\n").unwrap();
        assert!(budget.bytes <= 1);
        assert!(budget.observe(&vec![b'x'; MESSAGE_BYTES + 1]).is_err());
        let mut budget = SseBudget::default();
        for _ in 0..10 {
            budget.observe(b"data: ok\n\n").unwrap();
        }
        assert_eq!(budget.bytes, 0);
    }
}
