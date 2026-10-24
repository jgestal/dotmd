use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct WatchState(Mutex<Option<RecommendedWatcher>>);

/// Watches the open document and emits `file-changed` when another program modifies it.
/// The parent directory is watched because many editors save by atomic rename.
#[tauri::command]
pub fn watch_file(app: AppHandle, state: tauri::State<WatchState>, path: Option<String>) -> Result<(), String> {
    let mut slot = state.0.lock().unwrap();
    *slot = None;
    let Some(path) = path else { return Ok(()) };
    let target = PathBuf::from(&path);
    let Some(dir) = target.parent().map(|d| d.to_path_buf()) else { return Ok(()) };

    let watched = target.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(ev) = res else { return };
        if !matches!(ev.kind, EventKind::Modify(_) | EventKind::Create(_)) {
            return;
        }
        if ev.paths.iter().any(|p| p == &watched) {
            let _ = app.emit("file-changed", watched.to_string_lossy().to_string());
        }
    })
    .map_err(|e| e.to_string())?;
    watcher.watch(&dir, RecursiveMode::NonRecursive).map_err(|e| e.to_string())?;
    *slot = Some(watcher);
    Ok(())
}
