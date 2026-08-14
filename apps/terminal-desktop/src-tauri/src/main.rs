//! QuantOS Terminal desktop shell.
//!
//! 桌面壳只承载平台能力（PRE-03 PoC）：加载与 Web 完全相同的 Terminal 构建产物，
//! 注册 quantos:// 深链；业务逻辑零分叉（执行计划 1.1 节）。

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .run(tauri::generate_context!())
        .expect("error while running QuantOS Terminal");
}
