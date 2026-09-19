#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // SQLite 插件，P1 业务表在首次启动时由迁移脚本建
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let _ = app; // 占位，Batch 1 在这里做 DB 初始化
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
