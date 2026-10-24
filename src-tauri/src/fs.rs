use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct Entry {
    name: String,
    path: String,
    is_dir: bool,
}

/// Extensions DotMD opens as documents: Markdown, plain text, data and source code.
const TEXT_EXTS: &[&str] = &[
    "md", "markdown", "mdown", "mkd", "mdx", "txt", "text", "log", "rst", "adoc", "asciidoc", "org", "tex", "bib",
    "csv", "tsv", "json", "jsonc", "json5", "yaml", "yml", "toml", "ini", "cfg", "conf", "properties", "env", "xml",
    "html", "htm", "css", "scss", "less", "svg", "js", "mjs", "cjs", "ts", "jsx", "tsx", "vue", "svelte", "py", "rb",
    "rs", "go", "java", "kt", "kts", "swift", "c", "h", "cpp", "cc", "hpp", "cs", "php", "pl", "lua", "r", "sql", "sh",
    "bash", "zsh", "fish", "ps1", "bat", "dart", "scala", "clj", "ex", "exs", "erl", "hs", "ml", "nim", "zig", "srt",
    "vtt", "diff", "patch", "gradle", "cmake", "dockerfile", "gitignore", "editorconfig",
];

/// Common text files that have no extension.
const TEXT_NAMES: &[&str] = &["readme", "license", "licence", "changelog", "authors", "contributing", "makefile", "dockerfile", "procfile", "gemfile", "notes", "todo"];

pub(crate) fn is_text_file(p: &Path) -> bool {
    match p.extension().and_then(|e| e.to_str()) {
        Some(e) => TEXT_EXTS.contains(&e.to_ascii_lowercase().as_str()),
        None => p
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| TEXT_NAMES.contains(&n.to_ascii_lowercase().as_str())),
    }
}

/// Decodes UTF-8 (with or without BOM) and UTF-16 (with BOM); anything else that is not valid UTF-8
/// is read as Windows-1252/Latin-1, the usual encoding of older text files. Binary files are refused.
pub(crate) fn decode_text(bytes: &[u8]) -> Result<String, String> {
    if let Some(rest) = bytes.strip_prefix(b"\xEF\xBB\xBF") {
        return Ok(String::from_utf8_lossy(rest).into_owned());
    }
    let utf16 = |rest: &[u8], le: bool| {
        let units: Vec<u16> = rest
            .chunks_exact(2)
            .map(|c| if le { u16::from_le_bytes([c[0], c[1]]) } else { u16::from_be_bytes([c[0], c[1]]) })
            .collect();
        String::from_utf16_lossy(&units)
    };
    if let Some(rest) = bytes.strip_prefix(b"\xFF\xFE") {
        return Ok(utf16(rest, true));
    }
    if let Some(rest) = bytes.strip_prefix(b"\xFE\xFF") {
        return Ok(utf16(rest, false));
    }
    if bytes.iter().take(8000).any(|&b| b == 0) {
        return Err("binary".into());
    }
    match std::str::from_utf8(bytes) {
        Ok(s) => Ok(s.to_string()),
        Err(_) => Ok(bytes.iter().map(|&b| b as char).collect()),
    }
}

#[tauri::command]
pub fn read_text(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    decode_text(&bytes)
}

#[tauri::command]
pub fn write_text(path: String, content: String) -> Result<(), String> {
    // Write to a sibling temp file and rename, so a crash never leaves a half-written document.
    let target = PathBuf::from(&path);
    let tmp = target.with_extension(format!(
        "{}.dotmd-tmp",
        target.extension().and_then(|e| e.to_str()).unwrap_or("")
    ));
    std::fs::write(&tmp, content).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &target).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e.to_string()
    })
}

/// One directory level (lazy tree). Hidden entries are skipped; `all` also lists non-text files.
#[tauri::command]
pub fn list_dir(path: String, all: bool) -> Result<Vec<Entry>, String> {
    let mut out: Vec<Entry> = std::fs::read_dir(&path)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .filter_map(|d| {
            let name = d.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || name == "node_modules" || name == "target" {
                return None;
            }
            let p = d.path();
            let is_dir = p.is_dir();
            if !is_dir && !all && !is_text_file(&p) {
                return None;
            }
            Some(Entry { name, path: p.to_string_lossy().into_owned(), is_dir })
        })
        .collect();
    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

/// "dir", "file" or "missing".
#[tauri::command]
pub fn path_kind(path: String) -> &'static str {
    let p = Path::new(&path);
    if p.is_dir() {
        "dir"
    } else if p.is_file() {
        "file"
    } else {
        "missing"
    }
}

#[tauri::command]
pub fn rename_path(from: String, to: String) -> Result<(), String> {
    if Path::new(&to).exists() {
        return Err("exists".into());
    }
    std::fs::rename(from, to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Every text document under `path` (recursive, hidden folders skipped). Used by batch export.
#[tauri::command]
pub fn list_tree(path: String) -> Vec<String> {
    fn walk(dir: &Path, out: &mut Vec<String>, depth: usize) {
        if depth > 12 || out.len() >= 5000 {
            return;
        }
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        let mut entries: Vec<_> = rd.filter_map(|r| r.ok()).map(|d| d.path()).collect();
        entries.sort();
        for p in entries {
            let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            if name.starts_with('.') || name == "node_modules" || name == "target" {
                continue;
            }
            if p.is_dir() {
                walk(&p, out, depth + 1);
            } else if is_text_file(&p) {
                out.push(p.to_string_lossy().into_owned());
            }
        }
    }
    let mut out = Vec::new();
    walk(Path::new(&path), &mut out, 0);
    out
}

/// Reads an image as a `data:` URL so exported HTML is self-contained.
#[tauri::command]
pub fn read_data_url(path: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let ext = Path::new(&path).extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    };
    Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

/// Picks `assets/<stem>.<ext>` inside `dir`, adding -2, -3… if the name is taken. Returns (absolute, relative).
fn unique_asset(dir: &Path, name: &str) -> (PathBuf, String) {
    let clean: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '.' | '-' | '_') { c } else { '-' })
        .collect();
    let p = Path::new(&clean);
    let stem = p.file_stem().and_then(|s| s.to_str()).filter(|s| !s.is_empty()).unwrap_or("image").to_string();
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("png").to_ascii_lowercase();
    let assets = dir.join("assets");
    let mut n = 1;
    loop {
        let file = if n == 1 { format!("{stem}.{ext}") } else { format!("{stem}-{n}.{ext}") };
        let abs = assets.join(&file);
        if !abs.exists() {
            return (abs, format!("assets/{file}"));
        }
        n += 1;
    }
}

/// Saves a pasted image (base64) next to the document; returns the relative path to put in the Markdown.
#[tauri::command]
pub fn save_asset(dir: String, name: String, data: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(data).map_err(|e| e.to_string())?;
    let (abs, rel) = unique_asset(Path::new(&dir), &name);
    std::fs::create_dir_all(abs.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&abs, bytes).map_err(|e| e.to_string())?;
    Ok(rel)
}

/// Copies a dropped image file into the document's assets folder; returns the relative path.
#[tauri::command]
pub fn copy_asset(dir: String, src: String) -> Result<String, String> {
    let name = Path::new(&src).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "image.png".into());
    let (abs, rel) = unique_asset(Path::new(&dir), &name);
    std::fs::create_dir_all(abs.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::copy(&src, &abs).map_err(|e| e.to_string())?;
    Ok(rel)
}

#[cfg(test)]
mod tests {
    #[test]
    fn decodes_common_encodings() {
        use super::decode_text;
        assert_eq!(decode_text(b"\xEF\xBB\xBFhola").unwrap(), "hola");
        assert_eq!(decode_text(b"\xFF\xFEh\0i\0").unwrap(), "hi");
        assert_eq!(decode_text(b"caf\xE9").unwrap(), "café");
        assert_eq!(decode_text(b"\x89PNG\0\0").unwrap_err(), "binary");
    }

    #[test]
    fn recognises_text_files() {
        use std::path::Path;
        assert!(super::is_text_file(Path::new("a/notes.MD")));
        assert!(super::is_text_file(Path::new("data.csv")));
        assert!(super::is_text_file(Path::new("Makefile")));
        assert!(!super::is_text_file(Path::new("photo.jpg")));
    }

    #[test]
    fn assets_get_unique_names() {
        let dir = std::env::temp_dir().join(format!("dotmd-assets-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let d = dir.to_string_lossy().into_owned();
        assert_eq!(super::save_asset(d.clone(), "Screen Shot.png".into(), "AQ==".into()).unwrap(), "assets/Screen-Shot.png");
        assert_eq!(super::save_asset(d.clone(), "Screen Shot.png".into(), "Ag==".into()).unwrap(), "assets/Screen-Shot-2.png");
        let _ = std::fs::remove_dir_all(&dir);
    }
}

/// Moves a file or folder to the system trash / recycle bin.
#[tauri::command]
pub fn trash_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}
