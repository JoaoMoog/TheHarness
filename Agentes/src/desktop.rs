#![cfg_attr(
    all(target_os = "windows", not(debug_assertions)),
    windows_subsystem = "windows"
)]
mod backend;
mod chat;
mod chat_context;
mod chat_flow;
mod chat_index;
mod chat_mcp;
mod chat_mcp_client;
mod chat_memory;
mod chat_proxy;
mod chat_usage;
mod chat_worktree;
mod formatting;
mod mcp_transport;
mod performance;
mod scm;
mod stash;
mod terminal;
mod workbench;
use serde_json::{Value, json};
use std::{
    borrow::Cow,
    sync::{Arc, mpsc},
};
use tao::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, DeviceEventFilter, EventLoopBuilder},
    window::{Icon, WindowBuilder},
};
#[cfg(windows)]
use wry::{MemoryUsageLevel, WebViewExtWindows};
use wry::{WebContext, WebViewBuilder};
static ASSETS: include_dir::Dir = include_dir::include_dir!("$CARGO_MANIFEST_DIR/ui/dist");
#[derive(Debug)]
enum UiEvent {
    Reply(Value, Option<performance::Permit>),
    Exit,
    Browser(String),
}
fn dispatch(
    b: &backend::Backend,
    t: &terminal::Terminals,
    l: &workbench::Launcher,
    c: &chat::Chat,
    m: &str,
    p: &Value,
) -> backend::Result<Value> {
    let id = p["id"].as_u64().unwrap_or(0);
    match m {
        m if m.starts_with("chat_") => c.handle(b, m, p),
        "diagnostics" => Ok(terminal::diagnostics()),
        "launch_list" | "launch_import" => {
            l.list(&b.root(backend::strarg(p, "root")?)?, m == "launch_import")
        }
        "launch_start" => {
            let root = b.root(backend::strarg(p, "root")?)?;
            let launch = l.prepare(&root, p)?;
            let mut data = t.launch(
                &root,
                &format!(".NET · {}", launch.name),
                &launch.script,
                100,
                24,
            )?;
            data["ready"] = launch.ready;
            Ok(data)
        }
        "read_image" | "git_branches" | "git_switch" | "git_branch_delete" | "git_stashes"
        | "git_branch_create" | "git_remotes" | "git_publish" | "git_stash_create"
        | "git_stash_show" | "git_stash_files" | "git_stash_diff" | "git_stash_apply" | "git_stash_drop" | "git_conflict"
        | "git_resolve" | "git_merge_continue" | "git_merge_abort" => workbench::handle(b, m, p),
        "terminal_start" => t.start(
            &b.root(backend::strarg(p, "root")?)?,
            backend::strarg(p, "profile")?,
            p["cols"].as_u64().unwrap_or(100) as u16,
            p["rows"].as_u64().unwrap_or(25) as u16,
        ),
        "terminal_poll" => t.poll(id),
        "terminal_input" => t.input(id, backend::strarg(p, "data")?),
        "terminal_resize" => t.resize(
            id,
            p["cols"].as_u64().unwrap_or(100) as u16,
            p["rows"].as_u64().unwrap_or(25) as u16,
        ),
        "terminal_close" => t.close(id),
        _ => b.handle(m, p),
    }
}
fn main() {
    if let Err(e) = run() {
        let _ = rfd::MessageDialog::new()
            .set_title("SpeedCode")
            .set_description(format!("Falha ao iniciar: {e}"))
            .set_level(rfd::MessageLevel::Error)
            .show();
    }
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    let event_loop = EventLoopBuilder::<UiEvent>::with_user_event().build();
    // The workbench handles window/WebView input, not raw DeviceEvent data.
    // Do not register a redundant raw HID stream in the native host.
    event_loop.set_device_event_filter(DeviceEventFilter::Always);
    let proxy = event_loop.create_proxy();
    let pixels = image::load_from_memory(include_bytes!("../assets/speedcode.png"))?.into_rgba8();
    let icon = Icon::from_rgba(pixels.into_raw(), 256, 256)?;
    let window = WindowBuilder::new()
        .with_title(format!("SpeedCode {} · Agentic Workbench", env!("CARGO_PKG_VERSION")))
        .with_inner_size(tao::dpi::LogicalSize::new(1440., 900.))
        .with_min_inner_size(tao::dpi::LogicalSize::new(1000., 700.))
        .with_window_icon(Some(icon.clone()))
        .build(&event_loop)?;
    #[cfg(windows)]
    {
        use tao::platform::windows::WindowExtWindows;
        window.set_taskbar_icon(Some(icon.clone()));
    }
    let caption_icon = hide_title_icon(&window);
    let backend = Arc::new(backend::Backend::load());
    let terminals = Arc::new(terminal::Terminals::new());
    let launcher = Arc::new(workbench::Launcher::new());
    let chat = Arc::new(chat::Chat::new());
    let chat_shutdown = chat.clone();
    let term_shutdown = terminals.clone();
    // Fixed workers bound concurrent IPC work and keep disk/Git off the window thread.
    let (tx, rx) = mpsc::sync_channel::<(Value, performance::Permit)>(performance::REQUESTS);
    let rx = Arc::new(std::sync::Mutex::new(rx));
    for _ in 0..6 {
        let (rx, b, t, l, c, proxy) = (
            rx.clone(),
            backend.clone(),
            terminals.clone(),
            launcher.clone(),
            chat.clone(),
            proxy.clone(),
        );
        std::thread::spawn(move || {
            loop {
                let (req, permit) = match rx.lock().unwrap().recv() {
                    Ok(r) => r,
                    Err(_) => break,
                };
                let id = req["id"].clone();
                let method = req["method"].as_str().unwrap_or("");
                if method == "exit" {
                    t.close_all();
                    c.shutdown();
                    let _ = proxy.send_event(UiEvent::Exit);
                    continue;
                }
                let answer = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    if method == "browser_open" {
                        let url = workbench::preview_url(&b, &req["params"])?;
                        if req["params"]["external"].as_bool().unwrap_or(false) {
                            backend::hidden_command("explorer.exe")
                                .arg(&url)
                                .spawn()
                                .map_err(|e| e.to_string())?;
                        } else {
                            proxy
                                .send_event(UiEvent::Browser(url))
                                .map_err(|e| e.to_string())?;
                        }
                        Ok(json!(true))
                    } else {
                        dispatch(&b, &t, &l, &c, method, &req["params"])
                    }
                }));
                let payload = match answer {
                    Ok(Ok(result)) => json!({"id":id,"result":result}),
                    Ok(Err(error)) => json!({"id":id,"error":error}),
                    Err(_) => json!({"id":id,"error":"Falha interna na operação."}),
                };
                let _ = proxy.send_event(UiEvent::Reply(payload, Some(permit)));
            }
        });
    }
    let data = backend::data_dir().join("WebView2");
    // Preserve the legacy private origin so existing localStorage survives rebranding.
    std::fs::create_dir_all(&data)?;
    let mut context = WebContext::new(Some(data));
    let errors = proxy.clone();
    let ipc_budget = Arc::new(performance::RequestBudget::default());
    let webview=WebViewBuilder::new_with_web_context(&mut context).with_background_color((15,19,28,255)).with_devtools(cfg!(debug_assertions)).with_custom_protocol("agentdesk".into(),|_,req|{let path=req.uri().path().trim_start_matches('/');let path=if path.is_empty(){"index.html"}else{path};let file=ASSETS.get_file(path);let mime=if path.ends_with(".js"){"text/javascript"}else if path.ends_with(".css"){"text/css"}else if path.ends_with(".svg"){"image/svg+xml"}else if path.ends_with(".ttf"){"font/ttf"}else{"text/html"};wry::http::Response::builder().status(if file.is_some(){200}else{404}).header("Content-Type",mime).header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-src 'none'").body(Cow::Borrowed(file.map(|f|f.contents()).unwrap_or(b"Not found"))).unwrap()})
 .with_navigation_handler(|url|url.starts_with("http://agentdesk.localhost/")||url.starts_with("agentdesk://localhost/"))
 .with_ipc_handler(move|req|{
    if !req.uri().to_string().starts_with("http://agentdesk.localhost/"){return;}
    let Some(permit) = ipc_budget.reserve(req.body().len()) else {
        #[derive(serde::Deserialize)] struct Identity { id: Value }
        if let Ok(identity) = serde_json::from_str::<Identity>(req.body()) {
            let _=errors.send_event(UiEvent::Reply(json!({"id":identity.id,"error":"Limite de operações/bytes pendentes atingido; aguarde. Trabalho preservado."}),None));
        }
        return;
    };
    if let Ok(v)=serde_json::from_str::<Value>(req.body()){
        if let Err(error)=tx.try_send((v, permit)){
            let (v, _) = match error { mpsc::TrySendError::Full(v) | mpsc::TrySendError::Disconnected(v) => v };
            let _=errors.send_event(UiEvent::Reply(json!({"id":v["id"],"error":"Fila ocupada; aguarde a conclusão."}),None));
        }
    }
 })
 .with_url("agentdesk://localhost/index.html").build(&window)?;
    let mut browsers = std::collections::HashMap::new();
    event_loop.run(move |event, target, flow| {
        *flow = ControlFlow::Wait;
        match event {
            Event::UserEvent(UiEvent::Browser(url)) => {
                if browsers.len() >= performance::BROWSER_WINDOWS {
                    let _ = webview.evaluate_script(&format!("window.__previewError?.({})", json!("Limite de duas prévias abertas. Feche uma janela ou abra externamente para poupar recursos.")));
                    return;
                }
                // Separate webview with no IPC handler/custom protocol: untrusted HTML cannot invoke workspace commands.
                if let Ok(w) = WindowBuilder::new()
                    .with_title(format!("SpeedCode — Navegador · {url}"))
                    .with_window_icon(Some(icon.clone()))
                    .with_inner_size(tao::dpi::LogicalSize::new(1100., 750.))
                    .build(target)
                {
                    match WebViewBuilder::new().with_url(&url).build(&w) {
                        Ok(v) => {
                            browsers.insert(w.id(), (w, v));
                        }
                        Err(e) => {
                            let _ = webview.evaluate_script(&format!(
                                "window.__previewError?.({})",
                                json!(e.to_string())
                            ));
                        }
                    }
                }
            }
            Event::UserEvent(UiEvent::Reply(v, _permit)) => {
                let _ = webview.evaluate_script(&format!("window.__reply({v})"));
            }
            Event::UserEvent(UiEvent::Exit) => {
                *flow = ControlFlow::Exit;
            }
            #[cfg(windows)]
            Event::WindowEvent { event: WindowEvent::Focused(focused), window_id, .. }
                if window_id == window.id() => {
                // Advisory runtime trimming; no session reset/suspension or OS cap.
                let _ = webview.set_memory_usage_level(if focused { MemoryUsageLevel::Normal } else { MemoryUsageLevel::Low });
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                window_id,
                ..
            } => {
                if window_id == window.id() {
                    let _ = webview.evaluate_script("window.requestClose?.()");
                } else {
                    browsers.remove(&window_id);
                }
            }
            Event::LoopDestroyed => {
                let _ = &caption_icon; // retain the native transparent HICON for the window lifetime
                term_shutdown.close_all();
                chat_shutdown.shutdown();
            }
            _ => {}
        }
    });
}
#[cfg(windows)]
struct CaptionIcon(isize);
#[cfg(windows)]
impl Drop for CaptionIcon {
    fn drop(&mut self) {
        if self.0 != 0 {
            unsafe {
                windows_sys::Win32::UI::WindowsAndMessaging::DestroyIcon(self.0 as _);
            }
        }
    }
}
#[cfg(windows)]
fn hide_title_icon(window: &tao::window::Window) -> CaptionIcon {
    use tao::platform::windows::WindowExtWindows;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;
    // Dialog-frame style hides the caption glyph, retaining normal window controls
    // and the executable/taskbar icon. The in-app logo remains unchanged.
    // Null ICON_SMALL makes Windows fall back to ICON_BIG/the EXE resource.
    // A transparent small icon suppresses that fallback while retaining the
    // real taskbar icon and native system-menu/minimize/maximize/close controls.
    window.set_window_icon(None);
    unsafe {
        let hwnd = window.hwnd() as windows_sys::Win32::Foundation::HWND;
        // Monochrome AND=1, XOR=0 is fully transparent on classic and DWM
        // captions. Avoid Tao's RGBA alpha->AND conversion for an empty icon.
        let and_mask = [255u8; 32];
        let xor_mask = [0u8; 32];
        let blank = CreateIcon(
            std::ptr::null_mut(),
            16,
            16,
            1,
            1,
            and_mask.as_ptr(),
            xor_mask.as_ptr(),
        );
        if !blank.is_null() {
            SendMessageW(hwnd, WM_SETICON, ICON_SMALL as usize, blank as isize);
        }
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style | WS_EX_DLGMODALFRAME as isize);
        SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE,
        );
        CaptionIcon(blank as isize)
    }
}
#[cfg(not(windows))]
fn hide_title_icon(_: &tao::window::Window) {}
