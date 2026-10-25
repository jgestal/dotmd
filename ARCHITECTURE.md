# DotMD architecture

DotMD is a Tauri 2 app: a Rust backend (files, search, export, CLI) and a Svelte 5 frontend.
The frontend follows **Clean Architecture**: business rules in the middle, frameworks at the edges,
dependencies pointing inwards only.

```
            ┌──────────────────────────── presentation ────────────────────────────┐
            │  components/*.svelte · routes/ · commands.ts · menu.ts · actions.ts   │
            │                       ┌─────────── application ───────────┐          │
            │                       │  documents · workspace · files    │          │
            │                       │        ┌──── domain ────┐         │          │
            │                       │        │ documents       │         │          │
            │                       │        │ workspace       │         │          │
            │                       │        │ errors          │         │          │
            │                       │        └─────────────────┘         │          │
            │                       └──────────── ports ─────────────────┘          │
            └──────────── container.ts wires ports to infrastructure ──────────────┘
                     infrastructure/tauri (real)   ·   infrastructure/memory (tests)
```

## Layers

| Layer | Folder | May import | Contents |
|---|---|---|---|
| **Domain** | `src/lib/domain/` | nothing outside itself | Pure rules: tabs and documents (line endings, modes, closing, history, tasks, moves), workspace (folders, favourites), `AppError`. |
| **Ports** | `src/lib/ports/` | nothing (types only) | Interfaces the application needs: `FileSystem`, `Dialogs`, `AppWindow`, `FileWatcher`, `Notifier`, `Translate`, `MarkdownEngine`, `Exporter`, `SearchEngine`, `AppProcess`. |
| **Application** | `src/lib/application/` | domain, ports | Use cases: open/save/close/restore documents, live reload, folders and favourites (missing items, locate), move/rename/trash, images. They work on plain state objects. |
| **Infrastructure** | `src/lib/infrastructure/` | ports, domain | `tauri/`: adapters over Rust commands and plugins. `memory/`: in-memory doubles with scripted answers for tests. |
| **Presentation** | `components/`, `routes/`, `*.svelte.ts`, `commands.ts`, `menu.ts`, `actions.ts` | everything | Svelte components and stores, the command registry (shortcuts, palette, native menu), UI-only behaviour (zen, typewriter mode, editor insertions). |
| **Composition root** | `src/lib/container.ts` | everything | The only place that picks adapters and builds the use cases (dependency injection). |

The rule is **enforced by tests** (`src/lib/__tests__/architecture.test.ts`): the domain imports
nothing, the application only domain and ports, ports are pure types, and no module outside
`infrastructure/` calls a Rust command (`invoke`).

## Patterns

- **Ports & adapters (hexagonal)** for every external effect, so use cases are testable.
- **Dependency injection** through factory functions (`createDocuments(deps)`, …) wired in `container.ts`.
- **Repository-like** `FileSystem` port; **Strategy** for PDF engines (native WebKit, then Chromium)
  and typing sounds; **Command** pattern in `commands.ts` (one definition feeds shortcuts, palette
  and menu).
- **Centralised errors**: adapters turn backend failures into `AppError` (`domain/errors.ts`), and
  use cases report them through `Notifier` with one message mapping.

## Rust backend (`src-tauri/src`)

| Module | Responsibility |
|---|---|
| `lib.rs` | App setup, plugins, command registration, single instance, start-up safety net. |
| `cli.rs` | Argument parsing (pure, tested), `--help`, install of the `dotmd` command. |
| `fs.rs` | Text detection and decoding (UTF-8/16, Latin-1, binary), atomic writes, listings, assets. |
| `search.rs` | `rank` (fuzzy) and `search_roots` (grep) as pure functions; thin commands on top. |
| `export.rs` | PDF via the system WebKit (macOS, Linux) or headless Chromium. |
| `markdown.rs` | comrak options and rendering. |
| `watch.rs` | Live reload (file watcher). |

Commands stay thin; logic lives in plain functions that tests call directly with temporary folders.

## Testing strategy

| Level | Where | Runs | What it proves |
|---|---|---|---|
| **Unit** | `src/lib/__tests__/*.test.ts` (Vitest) | `npm test` | Domain rules and pure helpers (stats, CSV, TOC, pagination, paste, fuzzy, paths, commands). |
| **Use cases** | `__tests__/application.test.ts` | `npm test` | Application layer against in-memory adapters: dialogs, saving, line endings, tabs, history, favourites, moves, trash. |
| **Architecture** | `__tests__/architecture.test.ts` | `npm test` | The dependency rule. |
| **Rust unit + integration** | `#[cfg(test)]` in `src-tauri/src` | `cargo test` | Decoding, CLI parsing, search on real temporary trees, filesystem operations, assets. |
| **UI / component** | `tests/ui/scenarios/*.json` (headless Chrome, real comrak) | `npm run test:ui` | Every screen and flow with a fake Tauri bridge: modes, tabs, palette, search, favourites, paste, page view, export, sounds. |
| **End-to-end** | `tests/e2e/cli.mjs` (the real executable) | `npm run test:cli` | Launch shows a window, single instance, HTML/PDF export, batch, merge, long tables. |

Coverage: `npm run test:coverage` (thresholds: domain ≥ 90 %, application ≥ 80 % of lines).
CI runs all of it on Linux, the end-to-end suite on macOS, Windows and Linux, and builds installers.

## Adding a feature

1. Put the rule in `domain/` as a pure function, with a unit test.
2. If it needs the outside world, add or extend a **port**, then implement it in
   `infrastructure/tauri` (and `memory` for tests).
3. Write the use case in `application/`, taking its dependencies as arguments; test it with
   `memoryServices()`.
4. Wire it in `container.ts`, expose it to components (facade or command), add a UI scenario.
