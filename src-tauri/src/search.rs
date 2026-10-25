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
    let mut matcher = Matcher::new(Config::DEFAULT.match_paths());
    let pattern = Pattern::parse(&query, CaseMatching::Smart, Normalization::Smart);
    let mut buf = Vec::new();
    let mut hits: Vec<FuzzyHit> = files
        .iter()
        .filter_map(|p| {
            let r = rel(&root, p);
            let mut indices = Vec::new();
            let score = pattern.indices(Utf32Str::new(&r, &mut buf), &mut matcher, &mut indices)?;
            indices.sort_unstable();
            indices.dedup();
            Some(FuzzyHit { path: p.to_string_lossy().into_owned(), rel: r, score, indices })
        })
        .collect();
    hits.sort_by(|a, b| b.score.cmp(&a.score).then_with(|| a.rel.len().cmp(&b.rel.len())));
    hits.truncate(limit.max(1));
    Ok(hits)
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

#[tauri::command]
pub async fn search_folder(roots: Vec<String>, query: String, regex: bool, case_sensitive: bool, on_event: Channel<SearchEvent>) -> Result<(), String> {
    let generation = SEARCH_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    if query.is_empty() {
        let _ = on_event.send(SearchEvent::Done { files: 0, matches: 0, truncated: false });
        return Ok(());
    }
    let matcher = RegexMatcherBuilder::new()
        .case_smart(false)
        .case_insensitive(!case_sensitive)
        .fixed_strings(!regex)
        .build(&query)
        .map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        let many = roots.len() > 1;
        let mut searcher = SearcherBuilder::new().line_number(true).build();
        let (mut files, mut total, mut truncated) = (0, 0, false);
        let all = roots.iter().map(PathBuf::from).flat_map(|root| text_files(&root).into_iter().map(move |p| (root.clone(), p)));
        'outer: for (root, path) in all {
            if SEARCH_GEN.load(Ordering::SeqCst) != generation {
                return; // superseded by a newer search
            }
            let mut hits = Vec::new();
            let _ = searcher.search_path(
                &matcher,
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
            let _ = on_event.send(SearchEvent::File { path: path.to_string_lossy().into_owned(), rel: shown, matches: hits });
            if total >= MAX_MATCHES {
                truncated = true;
                break 'outer;
            }
        }
        let _ = on_event.send(SearchEvent::Done { files, matches: total, truncated });
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::preview;

    #[test]
    fn preview_ranges_are_char_based() {
        let (text, ranges) = preview("  café olé", &[(8, 12)]);
        assert_eq!(text, "café olé");
        let found: String = text.chars().skip(ranges[0].0).take(ranges[0].1 - ranges[0].0).collect();
        assert_eq!(found, "olé");
    }
}
