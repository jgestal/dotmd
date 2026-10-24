mod export;
mod fs;
mod search;
pub mod markdown;
mod watch;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// Paths the OS asked us to open (CLI args or Finder "Open with"), kept until the frontend asks.
#[derive(Default)]
pub struct PendingOpen(pub Mutex<Vec<String>>);

/// `dotmd --export pdf|html <input> <output>`: export without showing the window, then quit.
#[derive(Clone, serde::Serialize)]
pub struct CliExport {
    format: String,
    input: String,
    output: String,
}

#[derive(Default)]
pub struct PendingExport(pub Mutex<Option<CliExport>>);

#[tauri::command]
fn take_cli_export(state: tauri::State<PendingExport>) -> Option<CliExport> {
    state.0.lock().unwrap().take()
}

#[tauri::command]
fn quit(app: tauri::AppHandle, code: i32) {
    app.exit(code);
}

fn absolute(p: &str) -> String {
    let path = std::path::Path::new(p);
    if path.is_absolute() {
        p.to_string()
    } else {
        std::env::current_dir().map(|d| d.join(path).to_string_lossy().into_owned()).unwrap_or_else(|_| p.to_string())
    }
}

#[tauri::command]
fn take_pending_open(state: tauri::State<PendingOpen>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cli_export = match args.iter().position(|a| a == "--export") {
        Some(i) if args.len() >= i + 4 => Some(CliExport {
            format: args[i + 1].clone(),
            input: absolute(&args[i + 2]),
            output: absolute(&args[i + 3]),
        }),
        _ => None,
    };
    let cli_paths: Vec<String> = if cli_export.is_some() {
        Vec::new()
    } else {
        args.iter().filter(|a| !a.starts_with('-')).map(|a| absolute(a)).collect()
    };

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) { log::LevelFilter::Info } else { log::LevelFilter::Warn })
                .build(),
        )
        .manage(PendingOpen(Mutex::new(cli_paths)))
        .manage(PendingExport(Mutex::new(cli_export)))
        .manage(watch::WatchState::default())
        .manage(search::FileCache::default())
        .invoke_handler(tauri::generate_handler![
            take_pending_open,
            take_cli_export,
            quit,
            markdown::render_markdown,
            fs::read_text,
            fs::write_text,
            fs::list_dir,
            fs::path_kind,
            fs::rename_path,
            fs::create_file,
            fs::list_tree,
            fs::read_data_url,
            fs::save_asset,
            fs::copy_asset,
            fs::trash_path,
            watch::watch_files,
            search::fuzzy_find,
            search::search_folder,
            export::write_export,
            export::export_pdf,
            export::pdf_engine,
            export::export_pdf_native,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_handle, _event| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = _event {
            let paths: Vec<String> = urls
                .iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().into_owned())
                .collect();
            if let Some(state) = _handle.try_state::<PendingOpen>() {
                state.0.lock().unwrap().extend(paths.clone());
            }
            let _ = _handle.emit("open-paths", paths);
        }
    });
}
