mod cli;
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

#[derive(Default)]
pub struct PendingExport(pub Mutex<Option<cli::CliExport>>);

#[tauri::command]
fn take_cli_export(state: tauri::State<PendingExport>) -> Option<cli::CliExport> {
    state.0.lock().unwrap().take()
}

#[tauri::command]
fn quit(app: tauri::AppHandle, code: i32) {
    app.exit(code);
}

#[tauri::command]
fn take_pending_open(state: tauri::State<PendingOpen>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    let (cli_paths, cli_export) = match cli::parse(&args, &cwd) {
        cli::Cli::Open(paths) => (paths, None),
        cli::Cli::Export(job) => (Vec::new(), Some(job)),
        cli::Cli::Help => {
            print!("{}", cli::USAGE);
            return;
        }
        cli::Cli::Version => {
            println!("dotmd {}", env!("CARGO_PKG_VERSION"));
            return;
        }
        cli::Cli::Error(msg) => {
            eprintln!("dotmd: {msg}\n\n{}", cli::USAGE);
            std::process::exit(2);
        }
    };
    let exporting = cli_export.is_some();

    let mut builder = tauri::Builder::default();
    if !exporting {
        // A second `dotmd file.md` hands its files to the running window and exits (like `code`).
        // Exports run as their own headless process so they can report an exit code.
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let args: Vec<String> = argv.into_iter().skip(1).collect();
            if let cli::Cli::Open(paths) = cli::parse(&args, std::path::Path::new(&cwd)) {
                log::info!("second launch: opening {paths:?}");
                if let Some(state) = app.try_state::<PendingOpen>() {
                    state.0.lock().unwrap().extend(paths.clone());
                }
                let _ = app.emit("open-paths", paths);
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }));
    }
    let app = builder
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
            cli::install_cli,
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
