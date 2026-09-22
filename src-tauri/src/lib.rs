use tauri_plugin_sql::{Migration, MigrationKind};
use std::fs;
use std::path::Path;
use tauri::Manager;

#[tauri::command]
fn get_template_base(app: tauri::AppHandle) -> Result<String, String> {
    if cfg!(debug_assertions) {
        // 开发模式：直接用项目内的模板目录
        Ok("D:\\project\\社团财务软件项目\\模板\\内置模板\\".to_string())
    } else {
        // 打包/免安装模式：依次尝试 资源目录 / exe 所在目录 / 当前目录 下的 模板/内置模板
        let candidates = [
            app.path().resource_dir().ok(),
            app.path().executable_dir().ok(),
            std::env::current_dir().ok(),
        ];
        for base in candidates.iter().flatten() {
            let p = base.join("模板").join("内置模板");
            if p.is_dir() {
                return Ok(p.to_string_lossy().to_string() + "\\");
            }
        }
        Err("找不到内置模板目录（模板/内置模板）".to_string())
    }
}

#[tauri::command]
fn copy_files(files: Vec<(String, String)>) -> Result<(), String> {
    for (src, dst) in &files {
        let dst_path = Path::new(dst);
        if let Some(parent) = dst_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::copy(src, dst).map_err(|e| format!("复制失败 {} -> {}: {}", src, dst, e))?;
    }
    Ok(())
}

#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(&["/c", "start", "", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_files(paths: Vec<String>) -> Result<(), String> {
    for p in &paths {
        let path = Path::new(p);
        if path.is_file() {
            fs::remove_file(path).map_err(|e| format!("删除失败 {}: {}", p, e))?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add plan_file_path",
            sql: include_str!("../migrations/002_plan_file.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "custom templates",
            sql: include_str!("../migrations/003_custom_templates.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:app.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            copy_files,
            ensure_dir,
            open_file,
            delete_files,
            get_template_base
        ])
        .setup(|app| {
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
