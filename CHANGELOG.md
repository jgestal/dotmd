# Changelog

## 0.3.0

**Writing**
- **32 sheet themes** that dress only the sheet (the interface stays neutral, light or dark): Calm, Notebook, Manuscript, Sepia Night, E-ink, Accessible, Gruvbox, Catppuccin, Solarized Dark, Typewriter, Screenplay, Continuous paper, CRT, MS-DOS, Terminal, Game Boy, Chalkboard, Teletype, Parchment, Mac OS X Aqua and more.
- Legible body text in every theme (decorative fonts for headings) and a WCAG contrast test for all palettes.
- **A cursor per theme** — a glowing block prompt in Terminal and CRT, a fading bar in Calm — and theme sounds (typewriter, chalk, quill).
- **Distraction-free mode** (⌘⇧↩) with a small bar that appears on mouse move: focus, typewriter scrolling, word goal.
- Writing time per session, word goal progress, readability for 8 languages.

**Output**
- **Output formats** chosen when exporting (Document, Book, GitHub, Typewriter, Continuous paper, Screenplay, or the sheet theme) with a **live preview of the real pages**; `--style` on the command line.
- **Presentations**: `---` separates slides, `Note:` for speaker notes, full-screen presenter (⌘⌥↩), 16:9 PDF or HTML decks, `--slides`.
- Long tables split across PDF pages with repeated headers; continuous paper redesigned with tear lines between sheets.

**Workspace**
- Several folders at once, **favourites** (files and folders) with missing-item warnings, sort by name or date, duplicate, copy relative path.
- Reopen closed tab (⌘⇧T), scroll position remembered per tab, ⌘-click links in the editor, hover previews of linked notes.
- Find next / previous, revert to saved, rename, show in Finder / Explorer, keyboard shortcuts sheet, a built-in Markdown guide.

**System**
- Native menus laid out per platform with live check marks and states; the window remembers its size and position; unsaved changes shown in the macOS close button; drag files out of the window to other apps.
- **8 languages**: English, Spanish, French, German, Italian, Portuguese, Catalan, Galician.
- Preferences export / import and a synced folder (Google Drive, Dropbox, iCloud).
- New macOS-style app icon.

**Under the hood**
- Clean architecture (domain, ports, use cases, adapters) with unit, use-case, Rust, UI and end-to-end tests on macOS, Windows and Linux.

## 0.2.0

- **Open any text file**: Markdown, plain text, logs, CSV/TSV (as a table), JSON, YAML, source code highlighted by language; UTF-8, UTF-16 and Latin-1; Windows line endings preserved.
- **Page view** (⌘⌥P): the document on A4/Letter sheets with the PDF margins and page numbers; manual page breaks.
- **Focus writing** (⌘⌥F): full screen, only the line being typed lit, caret centered.
- **Continuous paper theme** (green-bar tractor-feed paper, dot-matrix font) and **real typewriter sounds** with a margin bell.
- **Tabs**, back/forward, **quick open** (⌘P), **command palette** (⌘⇧P), **folder search** (⌘⇧F), native menu bar with Open Recent.
- **Smart paste**: web content becomes Markdown, a URL over selected text becomes a link; paste or drop images into `assets/`.
- Visual mode shows GitHub callouts and `==highlight==`.
- **Copy as rich text** for Gmail, Docs and Word.
- Native PDF export on macOS and Linux; fonts embedded in HTML exports.
- **Command line**: `dotmd file.md` (reuses the window), `dotmd --export pdf|html INPUT… [-o OUT] [--merge]`; Help → Install "dotmd" command.
- **Automatic updates** from GitHub Releases (signed).

## 0.1.0

First version: read/source/split/visual modes, folder sidebar, toolbar, Mermaid, KaTeX, statistics, zen mode, 11 themes, English/Spanish, HTML/PDF export.
