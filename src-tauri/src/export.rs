use std::path::{Path, PathBuf};
use std::process::Command;

/// Writes an already rendered, self-contained HTML document.
#[tauri::command]
pub fn write_export(path: String, html: String) -> Result<(), String> {
    if let Some(dir) = Path::new(&path).parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, html).map_err(|e| e.to_string())
}

fn candidates() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = Vec::new();
    #[cfg(target_os = "macos")]
    for app in [
        "Google Chrome.app/Contents/MacOS/Google Chrome",
        "Chromium.app/Contents/MacOS/Chromium",
        "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "Brave Browser.app/Contents/MacOS/Brave Browser",
        "Vivaldi.app/Contents/MacOS/Vivaldi",
    ] {
        v.push(Path::new("/Applications").join(app));
        if let Some(home) = std::env::var_os("HOME") {
            v.push(Path::new(&home).join("Applications").join(app));
        }
    }
    #[cfg(target_os = "windows")]
    for base in ["ProgramFiles", "ProgramFiles(x86)", "LocalAppData"] {
        if let Some(b) = std::env::var_os(base) {
            let b = PathBuf::from(b);
            v.push(b.join(r"Microsoft\Edge\Application\msedge.exe"));
            v.push(b.join(r"Google\Chrome\Application\chrome.exe"));
            v.push(b.join(r"BraveSoftware\Brave-Browser\Application\brave.exe"));
        }
    }
    #[cfg(target_os = "linux")]
    for name in ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"] {
        for dir in ["/usr/bin", "/usr/local/bin", "/snap/bin", "/opt/google/chrome"] {
            v.push(Path::new(dir).join(name));
        }
    }
    v
}

fn find_engine() -> Option<PathBuf> {
    candidates().into_iter().find(|p| p.is_file())
}

/// Name of the Chromium-based browser used for silent PDF export, if any.
#[tauri::command]
pub fn pdf_engine() -> Option<String> {
    find_engine().map(|p| p.to_string_lossy().into_owned())
}

/// Prints static HTML to PDF with a headless Chromium engine (identical output on every OS).
#[tauri::command]
pub async fn export_pdf(html: String, out: String) -> Result<(), String> {
    let engine = find_engine().ok_or("no-engine")?;
    let tmp = std::env::temp_dir().join(format!(
        "dotmd-{}-{}.html",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    std::fs::write(&tmp, html).map_err(|e| e.to_string())?;
    if let Some(dir) = Path::new(&out).parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let profile = std::env::temp_dir().join("dotmd-pdf-profile");
    let url = format!("file://{}", tmp.to_string_lossy().replace('\\', "/"));
    let result = tauri::async_runtime::spawn_blocking(move || {
        Command::new(engine)
            .args([
                "--headless=new",
                "--disable-gpu",
                "--no-first-run",
                "--no-default-browser-check",
                "--no-pdf-header-footer",
                "--allow-file-access-from-files",
                "--virtual-time-budget=4000",
            ])
            .arg(format!("--user-data-dir={}", profile.to_string_lossy()))
            .arg(format!("--print-to-pdf={out}"))
            .arg(url)
            .output()
    })
    .await
    .map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&tmp);
    let output = result.map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).into_owned());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    #[ignore = "needs a Chromium-based browser installed"]
    fn prints_pdf() {
        let out = std::env::temp_dir().join("dotmd-test.pdf");
        let _ = std::fs::remove_file(&out);
        let html = "<!doctype html><html><body><h1>Hola PDF</h1><p>Prueba</p></body></html>".to_string();
        tauri::async_runtime::block_on(super::export_pdf(html, out.to_string_lossy().into_owned())).unwrap();
        let bytes = std::fs::read(&out).unwrap();
        assert!(bytes.starts_with(b"%PDF"));
        println!("{} bytes", bytes.len());
    }
}
