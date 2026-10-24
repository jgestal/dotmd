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

/// Page size in PostScript points (1/72 in) for the names the export dialog offers.
fn paper_points(size: &str) -> (f64, f64) {
    match size {
        "Letter" => (612.0, 792.0),
        "Legal" => (612.0, 1008.0),
        "A5" => (419.53, 595.28),
        _ => (595.28, 841.89), // A4
    }
}

/// Prints HTML to a paginated PDF with the system WebKit (no browser needed).
/// A hidden window loads the document, then an NSPrintOperation saves straight to `out`.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn export_pdf_native(app: tauri::AppHandle, html: String, out: String, page_size: String, margin_mm: f64) -> Result<(), String> {
    use std::sync::mpsc;
    use std::time::{Duration, Instant};
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    static SEQ: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    let label = format!("pdf-{}", SEQ.fetch_add(1, std::sync::atomic::Ordering::SeqCst));
    let (pw, ph) = paper_points(&page_size);
    let margin = margin_mm * 72.0 / 25.4;
    let _ = std::fs::remove_file(&out);

    let win = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External("about:blank".parse().unwrap()))
        .visible(false)
        .inner_size(pw - 2.0 * margin, ph)
        .build()
        .map_err(|e| e.to_string())?;

    let result = async {
        win.with_webview(move |w| unsafe {
            let wk = &*(w.inner() as *const objc2_web_kit::WKWebView);
            let base = objc2_foundation::NSURL::fileURLWithPath(&objc2_foundation::NSString::from_str(&std::env::temp_dir().to_string_lossy()));
            wk.loadHTMLString_baseURL(&objc2_foundation::NSString::from_str(&html), Some(&base));
        })
        .map_err(|e| e.to_string())?;

        // Wait for the document (and its inlined fonts/images) to finish loading.
        let start = Instant::now();
        loop {
            tokio_sleep(Duration::from_millis(100)).await;
            let (tx, rx) = mpsc::channel();
            win.with_webview(move |w| unsafe {
                let wk = &*(w.inner() as *const objc2_web_kit::WKWebView);
                let _ = tx.send(wk.isLoading());
            })
            .map_err(|e| e.to_string())?;
            let loading = rx.recv_timeout(Duration::from_secs(2)).unwrap_or(true);
            if !loading || start.elapsed() > Duration::from_secs(20) {
                break;
            }
        }
        tokio_sleep(Duration::from_millis(400)).await; // let layout settle

        let target = out.clone();
        win.with_webview(move |w| unsafe {
            use objc2::runtime::AnyObject;
            use objc2_app_kit::{NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob, NSPrintingPaginationMode, NSWindow};
            use objc2_foundation::{NSSize, NSString, NSURL};

            let wk = &*(w.inner() as *const objc2_web_kit::WKWebView);
            let window = &*(w.ns_window() as *const NSWindow);
            let info = NSPrintInfo::new();
            info.setJobDisposition(NSPrintSaveJob);
            let url = NSURL::fileURLWithPath(&NSString::from_str(&target));
            let dict = info.dictionary();
            let key: &AnyObject = &*(NSPrintJobSavingURL as *const NSString as *const AnyObject);
            let _: () = objc2::msg_send![&*dict, setObject: &*url, forKey: key];
            info.setPaperSize(NSSize::new(pw, ph));
            info.setTopMargin(margin);
            info.setBottomMargin(margin);
            info.setLeftMargin(margin);
            info.setRightMargin(margin);
            info.setHorizontalPagination(NSPrintingPaginationMode::Fit);
            info.setVerticalPagination(NSPrintingPaginationMode::Automatic);
            info.setHorizontallyCentered(false);
            info.setVerticallyCentered(false);
            let op = wk.printOperationWithPrintInfo(&info);
            op.setShowsPrintPanel(false);
            op.setShowsProgressPanel(false);
            // WKWebView prints blank pages unless its print view has a real frame.
            if let Some(view) = op.view() {
                view.setFrame(objc2_foundation::NSRect::new(
                    objc2_foundation::NSPoint::new(0.0, 0.0),
                    NSSize::new(pw - 2.0 * margin, ph - 2.0 * margin),
                ));
            }
            op.runOperationModalForWindow_delegate_didRunSelector_contextInfo(window, None, None, std::ptr::null_mut());
        })
        .map_err(|e| e.to_string())?;

        // The operation runs asynchronously: wait until the file exists and stops growing.
        let start = Instant::now();
        let mut last = 0u64;
        loop {
            tokio_sleep(Duration::from_millis(250)).await;
            let size = std::fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
            if size > 0 && size == last {
                return Ok(());
            }
            last = size;
            if start.elapsed() > Duration::from_secs(60) {
                return Err("timeout".to_string());
            }
        }
    }
    .await;
    let _ = win.close();
    result
}

#[cfg(target_os = "macos")]
async fn tokio_sleep(d: std::time::Duration) {
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(d)).await;
}

/// Native PDF is only implemented on macOS for now; elsewhere the caller uses Chromium.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn export_pdf_native(html: String, out: String, page_size: String, margin_mm: f64) -> Result<(), String> {
    let _ = (html, out, page_size, margin_mm);
    Err("unsupported".into())
}
