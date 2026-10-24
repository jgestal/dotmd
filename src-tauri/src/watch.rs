use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct WatchState(Mutex<Option<RecommendedWatcher>>);

/// Watches every open document (one per tab) and emits `file-changed` with the path when another
/// program modifies one. Parent directories are watched because many editors save by atomic rename.
#[tauri::command]
pub fn watch_files(app: AppHandle, state: tauri::State<WatchState>, paths: Vec<String>) -> Result<(), String> {
    let mut slot = state.0.lock().unwrap();
    *slot = None;
    let targets: HashSet<PathBuf> = paths.iter().map(PathBuf::from).collect();
    if targets.is_empty() {
        return Ok(());
    }
    let dirs: HashSet<PathBuf> = targets.iter().filter_map(|p| p.parent().map(|d| d.to_path_buf())).collect();

    let watched = targets.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(ev) = res else { return };
        if !matches!(ev.kind, EventKind::Modify(_) | EventKind::Create(_)) {
            return;
        }
        for p in ev.paths.iter().filter(|p| watched.contains(*p)) {
            let _ = app.emit("file-changed", p.to_string_lossy().to_string());
        }
    })
    .map_err(|e| e.to_string())?;
    for dir in dirs {
        watcher.watch(&dir, RecursiveMode::NonRecursive).map_err(|e| e.to_string())?;
    }
    *slot = Some(watcher);
    Ok(())
}
