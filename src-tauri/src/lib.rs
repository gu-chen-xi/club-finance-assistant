use tauri_plugin_sql::{Migration, MigrationKind};
use std::fs;
use std::path::Path;

#[tauri::command]
fn copy_files(files: Vec<(String, String)>) -> Result<(), String> {
    // 先检查所有源文件，避免复制到一半才失败
    for (src, _) in &files {
        if !Path::new(src).is_file() {
            return Err(format!("源文件不存在: {}", src));
        }
    }
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

/// 归档根目录：从 exe 所在位置向上找同时包含 src 和 src-tauri 的项目根目录，
/// 在根目录下创建「归档」文件夹；找不到（如安装版）则退回「文档\社团财务报账归档」
#[tauri::command]
fn archive_root() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut cur = exe.parent();
    while let Some(dir) = cur {
        if dir.join("src-tauri").is_dir() && dir.join("src").is_dir() {
            let root = dir.join("归档");
            fs::create_dir_all(&root).map_err(|e| e.to_string())?;
            return Ok(root.to_string_lossy().to_string());
        }
        cur = dir.parent();
    }

    let profile = std::env::var("USERPROFILE").map_err(|_| "无法定位用户目录".to_string())?;
    let root = Path::new(&profile)
        .join("Documents")
        .join("社团财务报账归档");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root.to_string_lossy().to_string())
}

/// 在 parent 下创建 name 目录，重名时追加 (2)(3)…
#[tauri::command]
fn create_unique_dir(parent: String, name: String) -> Result<String, String> {
    if name.trim().is_empty() || name.contains(&['/', '\\'][..]) {
        return Err("目录名不合法".to_string());
    }
    let base = Path::new(&parent);
    fs::create_dir_all(base).map_err(|e| e.to_string())?;

    let mut candidate = base.join(&name);
    let mut i = 2;
    while candidate.exists() {
        if i > 999 {
            return Err("同名归档目录过多".to_string());
        }
        candidate = base.join(format!("{}({})", name, i));
        i += 1;
    }
    fs::create_dir_all(&candidate).map_err(|e| e.to_string())?;
    Ok(candidate.to_string_lossy().to_string())
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
        Migration {
            version: 4,
            description: "acceptance confirmed",
            sql: include_str!("../migrations/004_acceptance_confirmed.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "plan files and archive path",
            sql: include_str!("../migrations/005_plan_files_and_archive.sql"),
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
            archive_root,
            create_unique_dir
        ])
        .setup(|app| {
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
