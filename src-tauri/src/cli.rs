//! Command line: `dotmd [files…]`, `dotmd --export pdf|html <inputs…> [-o <out>] [--merge] [--slides]`,
//! `--help`, `--version`. Also installs the `dotmd` command on the PATH.
use serde::Serialize;
use std::path::{Path, PathBuf};

pub const USAGE: &str = "DotMD — Markdown Viewer & Editor

Usage:
  dotmd [FILE|FOLDER…]                       open in DotMD (reuses the open window)
  dotmd --export pdf|html INPUT… [-o OUT]    export without opening a window
        --merge                              put every input into one file (needs -o FILE)
        --slides                             export as slides (--- separates them; 16:9 pages)
        --style NAME                         output format: document, book, github, typewriter,
                                             tractor, screenplay or sheet (default: as in Settings)
  dotmd --help | --version

Examples:
  dotmd notes.md
  dotmd --export pdf notes.md                → notes.pdf next to notes.md
  dotmd --export html docs/ -o site/         → every document under docs/ into site/
  dotmd --export pdf a.md b.md --merge -o book.pdf
  dotmd --export pdf talk.md --slides        → talk.pdf, one slide per page
  dotmd --export pdf novel.md --style book
";

#[derive(Clone, Serialize, Debug, PartialEq)]
pub struct CliExport {
    pub format: String,
    /// Files or folders (folders are expanded by the frontend).
    pub inputs: Vec<String>,
    /// Output file (single input or --merge) or folder; None = next to each input.
    pub output: Option<String>,
    pub merge: bool,
    pub slides: bool,
    /// Output format id (None = the one chosen in Settings).
    pub style: Option<String>,
}

#[derive(Debug, PartialEq)]
pub enum Cli {
    Open(Vec<String>),
    Export(CliExport),
    Help,
    Version,
    Error(String),
}

fn absolute(p: &str, cwd: &Path) -> String {
    let path = Path::new(p);
    if path.is_absolute() { p.to_string() } else { cwd.join(path).to_string_lossy().into_owned() }
}

/// Parses arguments (without the program name). `cwd` resolves relative paths, which matters when a
/// second launch forwards its arguments to the running instance.
pub fn parse(args: &[String], cwd: &Path) -> Cli {
    // macOS adds -psn_… when launched from Finder; ignore any unknown -flags when opening files.
    if args.iter().any(|a| a == "--help" || a == "-h") {
        return Cli::Help;
    }
    if args.iter().any(|a| a == "--version" || a == "-V") {
        return Cli::Version;
    }
    let Some(i) = args.iter().position(|a| a == "--export") else {
        return Cli::Open(args.iter().filter(|a| !a.starts_with('-')).map(|a| absolute(a, cwd)).collect());
    };
    let format = match args.get(i + 1).map(|s| s.to_ascii_lowercase()) {
        Some(f) if f == "pdf" || f == "html" => f,
        _ => return Cli::Error("--export needs a format: pdf or html".into()),
    };
    let mut inputs = Vec::new();
    let mut output = None;
    let mut merge = false;
    let mut slides = false;
    let mut style = None;
    let mut rest = args[i + 2..].iter();
    while let Some(a) = rest.next() {
        match a.as_str() {
            "-o" | "--out" | "--output" => match rest.next() {
                Some(o) => output = Some(absolute(o, cwd)),
                None => return Cli::Error(format!("{a} needs a path")),
            },
            "--merge" => merge = true,
            "--slides" => slides = true,
            "--style" => match rest.next() {
                Some(s) if !s.starts_with('-') => style = Some(s.to_lowercase()),
                _ => return Cli::Error("--style needs a name".into()),
            },
            s if s.starts_with('-') => return Cli::Error(format!("unknown option {s}")),
            s => inputs.push(absolute(s, cwd)),
        }
    }
    // Backwards compatible form: `--export pdf in.md out.pdf`.
    if output.is_none() && inputs.len() == 2 && !merge && Path::new(&inputs[1]).extension().is_some_and(|e| e.eq_ignore_ascii_case(&format)) {
        output = inputs.pop();
    }
    if inputs.is_empty() {
        return Cli::Error("nothing to export".into());
    }
    if merge && output.is_none() {
        return Cli::Error("--merge needs -o FILE".into());
    }
    if merge && slides {
        return Cli::Error("--slides and --merge cannot be combined".into());
    }
    Cli::Export(CliExport { format, inputs, output, merge, slides, style })
}

/// Puts a `dotmd` command on the PATH that runs this executable (like VS Code's "Install 'code'
/// command"). Returns the installed path.
#[tauri::command]
pub fn install_cli() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    install_for(&exe)
}

#[cfg(unix)]
fn install_for(exe: &Path) -> Result<String, String> {
    let target = if cfg!(target_os = "macos") {
        PathBuf::from("/usr/local/bin/dotmd")
    } else {
        // Linux packages already install /usr/bin/dotmd; AppImages get a user-level link.
        if Path::new("/usr/bin/dotmd").exists() {
            return Ok("/usr/bin/dotmd".into());
        }
        std::env::var_os("HOME").map(|h| Path::new(&h).join(".local/bin/dotmd")).ok_or("no HOME")?
    };
    if std::fs::read_link(&target).is_ok_and(|t| t == exe) {
        return Ok(target.to_string_lossy().into_owned());
    }
    let link = || -> std::io::Result<()> {
        if let Some(dir) = target.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let _ = std::fs::remove_file(&target);
        std::os::unix::fs::symlink(exe, &target)
    };
    match link() {
        Ok(()) => Ok(target.to_string_lossy().into_owned()),
        #[cfg(target_os = "macos")]
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
            // /usr/local/bin is root-owned on a clean Mac: ask for an administrator password.
            let script = format!(
                "do shell script \"mkdir -p /usr/local/bin && ln -sf '{}' '{}'\" with administrator privileges",
                exe.display(),
                target.display()
            );
            let ok = std::process::Command::new("osascript").args(["-e", &script]).status().map(|s| s.success()).unwrap_or(false);
            if ok { Ok(target.to_string_lossy().into_owned()) } else { Err("cancelled".into()) }
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(windows)]
fn install_for(exe: &Path) -> Result<String, String> {
    // %LOCALAPPDATA%\Microsoft\WindowsApps is on every user's PATH by default.
    let dir = std::env::var_os("LOCALAPPDATA").map(|d| Path::new(&d).join("Microsoft").join("WindowsApps")).ok_or("no LOCALAPPDATA")?;
    let shim = dir.join("dotmd.cmd");
    std::fs::write(&shim, format!("@\"{}\" %*\r\n", exe.display())).map_err(|e| e.to_string())?;
    Ok(shim.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(s: &str) -> Vec<String> {
        s.split_whitespace().map(String::from).collect()
    }
    const CWD: &str = "/work";

    #[test]
    fn opens_files_relative_to_cwd() {
        assert_eq!(parse(&args("notes.md /abs/x.md"), Path::new(CWD)), Cli::Open(vec!["/work/notes.md".into(), "/abs/x.md".into()]));
        assert_eq!(parse(&args("-psn_0_123 a.md"), Path::new(CWD)), Cli::Open(vec!["/work/a.md".into()]));
        assert_eq!(parse(&[], Path::new(CWD)), Cli::Open(vec![]));
    }

    #[test]
    fn parses_exports() {
        let e = |s: &str| match parse(&args(s), Path::new(CWD)) {
            Cli::Export(x) => x,
            other => panic!("{other:?}"),
        };
        assert_eq!(e("--export pdf a.md").output, None);
        assert_eq!(e("--export pdf a.md out.pdf").output.as_deref(), Some("/work/out.pdf")); // legacy form
        let batch = e("--export HTML a.md b.md docs -o site");
        assert_eq!(batch.format, "html");
        assert_eq!(batch.inputs, vec!["/work/a.md", "/work/b.md", "/work/docs"]);
        assert_eq!(batch.output.as_deref(), Some("/work/site"));
        assert!(e("--export pdf a.md b.md --merge -o book.pdf").merge);
        assert!(e("--export pdf talk.md --slides").slides);
        assert_eq!(e("--export pdf a.md --style Book").style.as_deref(), Some("book"));
        assert_eq!(e("--export pdf a.md").style, None);
        assert!(!e("--export pdf talk.md").slides);
    }

    #[test]
    fn reports_errors_and_help() {
        assert!(matches!(parse(&args("--export docx a.md"), Path::new(CWD)), Cli::Error(_)));
        assert!(matches!(parse(&args("--export pdf"), Path::new(CWD)), Cli::Error(_)));
        assert!(matches!(parse(&args("--export pdf a.md b.md --merge"), Path::new(CWD)), Cli::Error(_)));
        assert!(matches!(parse(&args("--export pdf a.md --bogus"), Path::new(CWD)), Cli::Error(_)));
        assert!(matches!(parse(&args("--export pdf a.md --style"), Path::new(CWD)), Cli::Error(_)));
        assert!(matches!(parse(&args("--export pdf a.md b.md --merge --slides -o x.pdf"), Path::new(CWD)), Cli::Error(_)));
        assert_eq!(parse(&args("--help"), Path::new(CWD)), Cli::Help);
        assert_eq!(parse(&args("-V"), Path::new(CWD)), Cli::Version);
    }
}
