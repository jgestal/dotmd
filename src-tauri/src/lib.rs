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

#[tauri::command]
fn take_pending_open(state: tauri::State<PendingOpen>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cli_paths: Vec<String> = std::env::args()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .collect();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) { log::LevelFilter::Info } else { log::LevelFilter::Warn })
                .build(),
        )
        .manage(PendingOpen(Mutex::new(cli_paths)))
        .manage(watch::WatchState::default())
        .manage(search::FileCache::default())
        .invoke_handler(tauri::generate_handler![
            take_pending_open,
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
