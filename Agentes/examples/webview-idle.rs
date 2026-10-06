//! Read-only baseline: minimal WebView2 vs a native window, with no workbench,
//! editor, Git, IPC, chat, terminals or auth. Never uses the user's app profile.
#![cfg_attr(
    all(target_os = "windows", not(debug_assertions)),
    windows_subsystem = "windows"
)]
use tao::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, DeviceEventFilter, EventLoopBuilder},
    window::WindowBuilder,
};
use wry::{WebContext, WebViewBuilder};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let native_only = std::env::args().any(|a| a == "--native-only");
    let event_loop = EventLoopBuilder::<()>::new().build();
    if !std::env::args().any(|a| a == "--raw-events") {
        event_loop.set_device_event_filter(DeviceEventFilter::Always);
    }
    let window = WindowBuilder::new()
        .with_title(if native_only {
            "SpeedCode Performance Probe — Native"
        } else {
            "SpeedCode Performance Probe — Minimal WebView2"
        })
        .with_inner_size(tao::dpi::LogicalSize::new(1440., 900.))
        .build(&event_loop)?;
    let profile = std::env::temp_dir().join(format!("speedcode-perf-probe-{}", std::process::id()));
    let mut context = WebContext::new(Some(profile));
    let view = if native_only {
        None
    } else {
        Some(WebViewBuilder::new_with_web_context(&mut context)
            .with_html("<!doctype html><meta charset=utf-8><title>Performance baseline</title><style>body{background:#0f131c;color:#ddd;font:16px system-ui;margin:30px}</style><p>Baseline WebView2 — sem editor, Git, chat, scripts ou IPC.</p>")
            .build(&window)?)
    };
    event_loop.run(move |event, _, flow| {
        // Keep WebView alive without timers or asynchronous work.
        let _ = &view;
        *flow = ControlFlow::Wait;
        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            *flow = ControlFlow::Exit;
        }
    });
}
