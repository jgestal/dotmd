//! Quick open (fuzzy file finder) and full-text search across the open folder.
use grep_matcher::Matcher as _;
use grep_regex::RegexMatcherBuilder;
use grep_searcher::{sinks::UTF8, SearcherBuilder};
use ignore::WalkBuilder;
use nucleo_matcher::pattern::{CaseMatching, Normalization, Pattern};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;

use crate::fs::is_text_file;

const MAX_FILES: usize = 20_000;
const MAX_MATCHES: usize = 2_000;
const LINE_PREVIEW: usize = 240;

/// Text documents under `root`, honouring .gitignore and skipping hidden entries.
fn text_files(root: &Path) -> Vec<PathBuf> {
    WalkBuilder::new(root)
        .hidden(true)
        .git_ignore(true)
        .max_depth(Some(16))
        .build()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_some_and(|t| t.is_file()))
        .map(|e| e.into_path())
        .filter(|p| is_text_file(p))
        .take(MAX_FILES)
        .collect()
}

fn rel(root: &Path, p: &Path) -> String {
    p.strip_prefix(root).unwrap_or(p).to_string_lossy().replace('\\', "/")
}

/// File lists per root, reused for a few seconds so typing in quick open does not rescan the disk.
#[derive(Default)]
pub struct FileCache(Mutex<HashMap<PathBuf, (Instant, Vec<PathBuf>)>>);

#[derive(Serialize)]
pub struct FuzzyHit {
    path: String,
    rel: String,
    score: u32,
    /// Character indices in `rel` that matched.
    indices: Vec<u32>,
}

/// Fuzzy-ranks `files` (relative to `root`) for `query`: best score first, shorter paths on ties.
pub fn rank(root: &Path, files: &[PathBuf], query: &str, limit: usize) -> Vec<FuzzyHit> {
    let mut matcher = Matcher::new(Config::DEFAULT.match_paths());
    let pattern = Pattern::parse(query, CaseMatching::Smart, Normalization::Smart);
    let mut buf = Vec::new();
    let mut hits: Vec<FuzzyHit> = files
        .iter()
        .filter_map(|p| {
            let r = rel(root, p);
            let mut indices = Vec::new();
            let score = pattern.indices(Utf32Str::new(&r, &mut buf), &mut matcher, &mut indices)?;
            indices.sort_unstable();
            indices.dedup();
            Some(FuzzyHit { path: p.to_string_lossy().into_owned(), rel: r, score, indices })
        })
        .collect();
    hits.sort_by(|a, b| b.score.cmp(&a.score).then_with(|| a.rel.len().cmp(&b.rel.len())));
    hits.truncate(limit.max(1));
    hits
}

#[tauri::command]
pub async fn fuzzy_find(cache: tauri::State<'_, FileCache>, root: String, query: String, limit: usize) -> Result<Vec<FuzzyHit>, String> {
    let root = PathBuf::from(root);
    let files = {
        let mut map = cache.0.lock().unwrap();
        match map.get(&root) {
            Some((at, files)) if at.elapsed() < Duration::from_secs(10) => files.clone(),
            _ => {
                let files = text_files(&root);
                map.insert(root.clone(), (Instant::now(), files.clone()));
                files
            }
        }
    };
    Ok(rank(&root, &files, &query, limit))
}

#[derive(Serialize, Clone)]
pub struct LineHit {
    line: u64,
    text: String,
    /// Character ranges of the matches inside `text`.
    ranges: Vec<(usize, usize)>,
}

#[derive(Serialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SearchEvent {
    File { path: String, rel: String, matches: Vec<LineHit> },
    Done { files: usize, matches: usize, truncated: bool },
}

/// Bumped by every new search so an older, still-running one stops early.
static SEARCH_GEN: AtomicU64 = AtomicU64::new(0);

/// Trims long lines to a window around the first match and converts byte ranges to char ranges.
fn preview(line: &str, byte_ranges: &[(usize, usize)]) -> (String, Vec<(usize, usize)>) {
    let line = line.trim_end_matches(['\r', '\n']);
    let first = byte_ranges.first().map(|r| r.0).unwrap_or(0).min(line.len());
    let mut start = first.saturating_sub(60);
    while !line.is_char_boundary(start) {
        start -= 1;
    }
    if start == 0 {
        start = line.len() - line.trim_start().len(); // drop indentation
    }
    let mut end = (start + LINE_PREVIEW).min(line.len());
    while !line.is_char_boundary(end) {
        end -= 1;
    }
    let prefix = if start > 0 && !line[..start].trim().is_empty() { "…" } else { "" };
    let shift = prefix.chars().count();
    let to_char = |b: usize| shift + line[start..b.clamp(start, end)].chars().count();
    let ranges = byte_ranges
        .iter()
        .filter(|(s, _)| *s >= start && *s < end)
        .map(|&(s, e)| (to_char(s), to_char(e)))
        .collect();
    (format!("{prefix}{}", &line[start..end]), ranges)
}

/// Searches every text file under `roots`, emitting one event per file with hits and a final
/// `Done`. Stops early when `cancelled()` turns true (a newer search started) or after MAX_MATCHES.
pub fn search_roots(roots: &[String], matcher: &grep_regex::RegexMatcher, cancelled: impl Fn() -> bool, mut emit: impl FnMut(SearchEvent)) {
    let many = roots.len() > 1;
    let mut searcher = SearcherBuilder::new().line_number(true).build();
    let (mut files, mut total, mut truncated) = (0, 0, false);
    let all = roots.iter().map(PathBuf::from).flat_map(|root| text_files(&root).into_iter().map(move |p| (root.clone(), p)));
    for (root, path) in all {
        if cancelled() {
            return;
        }
        let mut hits = Vec::new();
        let _ = searcher.search_path(
            matcher,
            &path,
            UTF8(|lnum, line| {
                let mut byte_ranges = Vec::new();
                let _ = matcher.find_iter(line.as_bytes(), |m| {
                    byte_ranges.push((m.start(), m.end()));
                    true
                });
                let (text, ranges) = preview(line, &byte_ranges);
                hits.push(LineHit { line: lnum, text, ranges });
                Ok(total + hits.len() < MAX_MATCHES)
            }),
        );
        if hits.is_empty() {
            continue;
        }
        files += 1;
        total += hits.len();
        // With several folders, prefix the folder name so results are unambiguous.
        let shown = if many { format!("{}/{}", root.file_name().map(|n| n.to_string_lossy()).unwrap_or_default(), rel(&root, &path)) } else { rel(&root, &path) };
        emit(SearchEvent::File { path: path.to_string_lossy().into_owned(), rel: shown, matches: hits });
        if total >= MAX_MATCHES {
            truncated = true;
            break;
        }
    }
    emit(SearchEvent::Done { files, matches: total, truncated });
}

/// Builds the line matcher for a query (literal unless `regex`).
pub fn matcher_for(query: &str, regex: bool, case_sensitive: bool) -> Result<grep_regex::RegexMatcher, String> {
    RegexMatcherBuilder::new().case_smart(false).case_insensitive(!case_sensitive).fixed_strings(!regex).build(query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_folder(roots: Vec<String>, query: String, regex: bool, case_sensitive: bool, on_event: Channel<SearchEvent>) -> Result<(), String> {
    let generation = SEARCH_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    if query.is_empty() {
        let _ = on_event.send(SearchEvent::Done { files: 0, matches: 0, truncated: false });
        return Ok(());
    }
    let matcher = matcher_for(&query, regex, case_sensitive)?;

    tauri::async_runtime::spawn_blocking(move || {
        search_roots(&roots, &matcher, || SEARCH_GEN.load(Ordering::SeqCst) != generation, |ev| {
            let _ = on_event.send(ev);
        });
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A temporary folder tree, removed when dropped.
    struct Tree(PathBuf);
    impl Tree {
        fn new(files: &[(&str, &str)]) -> Self {
            static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
            let n = N.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            let root = std::env::temp_dir().join(format!("dotmd-search-{}-{n}", std::process::id()));
            let _ = std::fs::remove_dir_all(&root);
            for (p, c) in files {
                let f = root.join(p);
                std::fs::create_dir_all(f.parent().unwrap()).unwrap();
                std::fs::write(f, c).unwrap();
            }
            Tree(root)
        }
        fn s(&self) -> String { self.0.to_string_lossy().into_owned() }
    }
    impl Drop for Tree {
        fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.0); }
    }

    fn run(roots: &[String], q: &str, regex: bool, case: bool) -> Vec<SearchEvent> {
        let mut out = Vec::new();
        search_roots(roots, &matcher_for(q, regex, case).unwrap(), || false, |e| out.push(e));
        out
    }

    #[test]
    fn finds_lines_in_text_files_only_and_respects_gitignore() {
        let t = Tree::new(&[
            ("a.md", "alpha\nthe Needle here\n"),
            ("sub/b.txt", "needle again"),
            ("photo.png", "needle in binary"),
            (".git/x.md", "needle hidden"),
            ("ignored/c.md", "needle ignored"),
            (".gitignore", "ignored/\n"),
        ]);
        // ignore only honours .gitignore inside a git repository
        std::fs::create_dir_all(t.0.join(".git")).unwrap();
        let ev = run(&[t.s()], "needle", false, false);
        let files: Vec<&str> = ev.iter().filter_map(|e| match e { SearchEvent::File { rel, .. } => Some(rel.as_str()), _ => None }).collect();
        assert_eq!(files.len(), 2, "{files:?}");
        assert!(files.contains(&"a.md") && files.contains(&"sub/b.txt"));
        match ev.last().unwrap() {
            SearchEvent::Done { files, matches, truncated } => assert_eq!((*files, *matches, *truncated), (2, 2, false)),
            _ => panic!("last event must be Done"),
        }
    }

    #[test]
    fn honours_case_and_regex_and_reports_line_numbers() {
        let t = Tree::new(&[("a.md", "one\nNeedle\nneedle 42\n")]);
        let ev = run(&[t.s()], "Needle", false, true);
        let SearchEvent::File { matches, .. } = &ev[0] else { panic!() };
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].line, 2);
        let ev = run(&[t.s()], r"needle \d+", true, false);
        let SearchEvent::File { matches, .. } = &ev[0] else { panic!() };
        assert_eq!((matches[0].line, matches[0].text.as_str()), (3, "needle 42"));
    }

    #[test]
    fn prefixes_folder_names_with_several_roots_and_can_be_cancelled() {
        let a = Tree::new(&[("x.md", "hit")]);
        let b = Tree::new(&[("y.md", "hit"), ("z.md", "hit")]);
        let ev = run(&[a.s(), b.s()], "hit", false, false);
        let rels: Vec<String> = ev.iter().filter_map(|e| match e { SearchEvent::File { rel, .. } => Some(rel.clone()), _ => None }).collect();
        assert!(rels.iter().all(|r| r.contains('/')), "{rels:?}");
        let mut out = Vec::new();
        search_roots(&[a.s()], &matcher_for("hit", false, false).unwrap(), || true, |e| out.push(e));
        assert!(out.is_empty(), "a cancelled search emits nothing");
    }

    #[test]
    fn ranks_fuzzy_matches() {
        let root = PathBuf::from("/r");
        let files: Vec<PathBuf> = ["notes/second.md", "README.md", "archive/old-secret-notes.md"].iter().map(|p| root.join(p)).collect();
        let hits = rank(&root, &files, "secnd", 10);
        assert_eq!(hits[0].rel, "notes/second.md");
        assert!(rank(&root, &files, "zzz", 10).is_empty());
        assert_eq!(rank(&root, &files, "md", 1).len(), 1);
    }

    #[test]
    fn preview_ranges_are_char_based() {
        let (text, ranges) = preview("  café olé", &[(8, 12)]);
        assert_eq!(text, "café olé");
        let found: String = text.chars().skip(ranges[0].0).take(ranges[0].1 - ranges[0].0).collect();
        assert_eq!(found, "olé");
    }
}
