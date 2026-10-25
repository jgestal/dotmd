//! Small pieces of operating-system integration: the image shown while dragging files out of the
//! app, and the macOS window's document state (represented file, unsaved-changes dot).
use std::path::PathBuf;

/// Path of the preview image used when dragging files from DotMD to other apps.
#[tauri::command]
pub fn drag_icon() -> Result<String, String> {
    let path: PathBuf = std::env::temp_dir().join("dotmd-drag-icon.png");
    if !path.exists() {
        std::fs::write(&path, include_bytes!("../icons/32x32.png")).map_err(|e| e.to_string())?;
    }
    Ok(path.to_string_lossy().into_owned())
}

/// Tells the window which file it shows and whether it has unsaved changes. On macOS this sets
/// the document of the NSWindow (the dot in the close button, the file in Mission Control);
/// elsewhere the window title already carries both.
#[tauri::command]
pub fn set_document(window: tauri::WebviewWindow, path: Option<String>, edited: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let w = window.clone();
        window
            .run_on_main_thread(move || {
                use objc2_app_kit::NSWindow;
                use objc2_foundation::NSString;
                if let Ok(ptr) = w.ns_window() {
                    // SAFETY: Tauri hands out the live NSWindow of this webview window; we are on the main thread.
                    let ns: &NSWindow = unsafe { &*(ptr as *const NSWindow) };
                    ns.setRepresentedFilename(&NSString::from_str(path.as_deref().unwrap_or("")));
                    ns.setDocumentEdited(edited);
                }
            })
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (window, path, edited);
    Ok(())
}
