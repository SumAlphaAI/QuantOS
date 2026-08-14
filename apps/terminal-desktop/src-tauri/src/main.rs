//! QuantOS Terminal desktop shell.
//!
//! 桌面壳只承载平台能力（PRE-03 PoC）：加载与 Web 完全相同的 Terminal 构建产物，
//! 注册并消费 quantos:// 深链；业务逻辑零分叉（执行计划 1.1 节）。

use quantos_terminal::deep_link::{local_navigation_url, sanitize_deep_link};
use tauri::{Manager, Url};
use tauri_plugin_deep_link::DeepLinkExt;

fn navigate_deep_links(app: &tauri::AppHandle, urls: Vec<Url>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(base) = window.url() else {
        return;
    };
    for url in urls {
        let Some(navigation) = sanitize_deep_link(&url) else {
            continue;
        };
        let target = local_navigation_url(&base, &navigation);
        let _ = window.navigate(target);
        let _ = window.show();
        let _ = window.set_focus();
        break;
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                navigate_deep_links(&handle, event.urls());
            });

            if let Some(urls) = app.deep_link().get_current()? {
                navigate_deep_links(app.handle(), urls);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running QuantOS Terminal");
}
