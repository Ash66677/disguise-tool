// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{Connection, Result};
use std::sync::Mutex;
use tauri::{Manager, State};
use tauri::WebviewWindowBuilder;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_fish_time(db: State<Database>) -> Result<String, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT total_fish_time FROM statistics WHERE id = 1")
        .map_err(|e| e.to_string())?;
    let time: i64 = stmt.query_row([], |row| row.get(0)).unwrap_or(0);
    Ok(time.to_string())
}

#[tauri::command]
fn update_fish_time(db: State<Database>, minutes: i64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE statistics SET total_fish_time = total_fish_time + ?1 WHERE id = 1",
        [minutes],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// 新增：打开伪装窗口命令（Tauri v2 版本）
#[tauri::command]
fn open_disguise_window(app: tauri::AppHandle) -> Result<(), String> {
    // 伪装页面的URL
    let disguise_url = "https://www.cnki.net/";
    
    // 检查窗口是否已经存在
    if let Some(window) = app.get_webview_window("disguise") {
        // 如果窗口已存在，显示并聚焦
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    
    // 创建新窗口（Tauri v2 使用 WebviewWindowBuilder）
    WebviewWindowBuilder::new(
        &app,
        "disguise",
        tauri::WebviewUrl::External(disguise_url.parse().unwrap())
    )
    .title("工作界面 - 知网")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

// 新增：关闭伪装窗口命令
#[tauri::command]
fn close_disguise_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("disguise") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

struct Database(Mutex<Connection>);

fn main() {
    let db = Database(Mutex::new(get_db_connection().expect("Failed to connect to database")));
    
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(db)
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_fish_time, 
            update_fish_time,
            open_disguise_window,
            close_disguise_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_db_connection() -> Result<Connection> {
    let app_dir = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    let db_path = std::path::Path::new(&app_dir).join("disguise_tool.db");
    let conn = Connection::open(&db_path)?;
    
    // Create tables if they don't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS statistics (
            id INTEGER PRIMARY KEY,
            total_fish_time INTEGER DEFAULT 0
        )",
        [],
    )?;
    
    // Insert default row if not exists
    conn.execute(
        "INSERT OR IGNORE INTO statistics (id, total_fish_time) VALUES (1, 0)",
        [],
    )?;
    
    Ok(conn)
}