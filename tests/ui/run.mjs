// UI test harness: runs the Svelte frontend in headless Chrome with a fake Tauri bridge.
// Rust commands are answered by this Node process; render_markdown uses the real comrak binary
// (src-tauri/examples/render.rs), so the HTML is exactly what the app renders.
//
//   node tests/ui/run.mjs                 # every scenario in tests/ui/scenarios
//   node tests/ui/run.mjs sounds tabs     # only these
//
// Scenario steps: eval, click, drag ([from, to] selectors), keys, chord (["Mod","Shift","KeyP"]), type, waitFor (JS condition), wait (ms), assert (must be true), shot.
//
// Env: CHROME_PATH (browser binary), UI_PORT (port of a fresh Vite server, default 1425). Screenshots go to tests/ui/out.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'out');
const PORT = Number(process.env.UI_PORT ?? 1425);
const BRIDGE = 1431;
const EXE = process.platform === 'win32' ? '.exe' : '';
const RENDER = path.join(ROOT, 'src-tauri/target/debug/examples', 'render' + EXE);

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const c = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
  }[process.platform] ?? [];
  const hit = c.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('No Chrome found; set CHROME_PATH');
  return hit;
}

if (!fs.existsSync(RENDER)) {
  console.log('building render example…');
  execFileSync('cargo', ['build', '-q', '--example', 'render'], { cwd: path.join(ROOT, 'src-tauri'), stdio: 'inherit' });
}

// Each scenario gets a fresh copy of the fixtures, so it may move, write or delete files freely.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dotmd-ui-'));
fs.mkdirSync(OUT, { recursive: true });

const TEXT = /\.(md|markdown|txt|csv|tsv|json|ya?ml|py|js|ts|rs|log)$/i;
let pendingOpen = [];
const handlers = {
  render_markdown: ({ text }) => execFileSync(RENDER, { input: text }).toString(),
  read_text: ({ path: p }) => fs.readFileSync(p, 'utf8'),
  write_text: ({ path: p, content }) => (fs.writeFileSync(p, content), null),
  path_kind: ({ path: p }) => (fs.existsSync(p) ? (fs.statSync(p).isDirectory() ? 'dir' : 'file') : 'missing'),
  list_dir: ({ path: p, all }) =>
    fs.readdirSync(p, { withFileTypes: true })
      .filter((d) => !d.name.startsWith('.') && (d.isDirectory() || all || TEXT.test(d.name)))
      .map((d) => ({ name: d.name, path: path.join(p, d.name), is_dir: d.isDirectory() }))
      .sort((a, b) => b.is_dir - a.is_dir || a.name.localeCompare(b.name)),
  list_tree: ({ path: p }) => fs.readdirSync(p, { recursive: true }).filter((f) => TEXT.test(f)).sort().map((f) => path.join(p, f)),
  take_pending_open: () => { const p = pendingOpen; pendingOpen = []; return p; },
  pdf_engine: () => findChrome(),
  read_data_url: () => 'data:image/png;base64,',
  write_export: ({ path: p, html }) => (fs.writeFileSync(p, html), null),
  rename_path: ({ from, to }) => { if (fs.existsSync(to)) throw 'exists'; fs.renameSync(from, to); return null; },
  trash_path: ({ path: p }) => (fs.rmSync(p, { recursive: true }), null),
  create_file: ({ path: p }) => (fs.writeFileSync(p, '', { flag: 'wx' }), null),
  fuzzy_find: ({ root, query }) => {
    const q = query.toLowerCase();
    return handlers.list_tree({ path: root })
      .map((p) => path.relative(root, p).replaceAll('\\', '/'))
      .filter((rel) => { let i = 0; for (const c of rel.toLowerCase()) if (c === q[i]) i++; return i === q.length; })
      .map((rel) => ({ path: path.join(root, rel), rel, score: 1, indices: [] }));
  },
  // Returns the events; the fake bridge feeds them to the Channel (see invoke below).
  search_folder: ({ root, query }) => {
    const events = [];
    let total = 0;
    for (const p of handlers.list_tree({ path: root })) {
      const matches = fs.readFileSync(p, 'utf8').split('\n').flatMap((text, i) => {
        const at = text.toLowerCase().indexOf(query.toLowerCase());
        return at < 0 ? [] : [{ line: i + 1, text, ranges: [[at, at + query.length]] }];
      });
      if (matches.length) { total += matches.length; events.push({ kind: 'file', path: p, rel: path.relative(root, p), matches }); }
    }
    events.push({ kind: 'done', files: events.length, matches: total, truncated: false });
    return events;
  },
  save_asset: ({ dir, name, data }) => {
    const d = path.join(dir, 'assets');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, name), Buffer.from(data, 'base64'));
    return 'assets/' + name;
  },
  copy_asset: ({ dir, src }) => {
    const d = path.join(dir, 'assets');
    fs.mkdirSync(d, { recursive: true });
    fs.copyFileSync(src, path.join(d, path.basename(src)));
    return 'assets/' + path.basename(src);
  },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.end();
  if (url.pathname === '/file') return fs.createReadStream(url.searchParams.get('path')).on('error', () => res.end()).pipe(res);
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const { cmd, args } = JSON.parse(body || '{}');
    let result = null, error = null;
    try { result = handlers[cmd] ? handlers[cmd](args || {}) : null; } catch (e) { error = String(e); }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ result: result ?? null, error }));
  });
});
await new Promise((r) => server.listen(BRIDGE, r));

async function viteUp() {
  try { return (await fetch(`http://127.0.0.1:${PORT}/`)).ok; } catch { return false; }
}
// Always a fresh Vite: a long-running dev server serves HMR-stamped module URLs, which would give
// scenarios that import app modules a second, empty copy of the state.
if (await viteUp()) throw new Error(`port ${PORT} is busy; stop that server or set UI_PORT`);
const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const vite = spawn(process.execPath, [viteBin, 'dev', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
const stopVite = () => { try { vite.kill(); } catch {} };
process.on('exit', stopVite);
for (let i = 0; i < 120 && !(await viteUp()); i++) await new Promise((r) => setTimeout(r, 500));

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--no-first-run', '--window-size=1280,860', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
  protocolTimeout: 60000,
  defaultViewport: { width: 1280, height: 860, deviceScaleFactor: 1 },
});

// Warm-up: a fresh Vite discovers and optimizes dependencies on first use and then reloads the
// page, which would break a running scenario. Load every lazily imported module (visual editor,
// Mermaid, all CodeMirror languages) up front and repeat until a pass completes without a reload.
const withTimeout = (p, ms, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))]);
for (let attempt = 1; attempt <= 4; attempt++) {
  const t0 = Date.now();
  const page = await browser.newPage();
  const ok = await withTimeout((async () => {
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(async () => {
      await Promise.all([import('/src/lib/components/VisualEditor.svelte'), import('/src/lib/editor/visual.ts')]);
      const [{ mermaidSvg }, { THEMES }] = await Promise.all([import('/src/lib/render.ts'), import('/src/lib/themes.ts')]);
      await mermaidSvg('flowchart LR\n  A --> B', THEMES[0]);
      const ld = await import('/node_modules/@codemirror/language-data/dist/index.js');
      await Promise.all(ld.languages.map((l) => l.load().catch(() => {})));
    });
    return true;
  })(), 90000, 'warm-up').catch((e) => (console.log(`warm-up ${attempt}: ${e.message.split('\n')[0]}`), false));
  // Closing a page that Vite is reloading can hang in puppeteer: never wait long for it.
  await withTimeout(page.close(), 5000, 'close').catch(() => {});
  if (process.env.UI_DEBUG) console.log(`warm-up ${attempt} ${ok ? 'ok' : 'retry'} in ${Date.now() - t0} ms`);
  if (ok) break;
  await new Promise((r) => setTimeout(r, 3000));
}

const wanted = process.argv.slice(2);
const files = fs.readdirSync(path.join(HERE, 'scenarios')).filter((f) => f.endsWith('.json'))
  .filter((f) => !wanted.length || wanted.includes(f.replace(/\.json$/, '')));
let failures = 0;

let currentPage = null;

/** Fails a scenario that hangs instead of blocking the whole run (e.g. Vite reloading mid-test). */
const SCENARIO_TIMEOUT = Number(process.env.UI_SCENARIO_TIMEOUT ?? 120000);

for (const file of files) {
  const name = file.replace(/\.json$/, '');
  let timer;
  const result = await Promise.race([
    runScenario(file, name),
    new Promise((res) => (timer = setTimeout(() => res([`scenario timed out after ${SCENARIO_TIMEOUT / 1000}s`]), SCENARIO_TIMEOUT))),
  ]);
  clearTimeout(timer);
  if (currentPage && !currentPage.isClosed()) await withTimeout(currentPage.close(), 5000, 'close').catch(() => {}); // a timed-out scenario
  console.log(`${result.length ? '✗' : '✓'} ${name}`);
  for (const f of result) console.log('    ' + f);
  failures += result.length ? 1 : 0;
}

async function runScenario(file, name) {
  const FIX = path.join(TMP, name);
  fs.cpSync(path.join(HERE, 'fixtures'), FIX, { recursive: true });
  const sc = JSON.parse(fs.readFileSync(path.join(HERE, 'scenarios', file), 'utf8').replaceAll('$FIX', FIX.replaceAll('\\', '/')));
  pendingOpen = sc.open ? [sc.open] : [];
  const page = await browser.newPage();
  currentPage = page;
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.evaluateOnNewDocument((fix) => { window.__FIX = fix; }, FIX.replaceAll('\\', '/'));
  await page.evaluateOnNewDocument((settings) => {
    localStorage.clear();
    if (settings) localStorage.setItem('dotmd.settings', JSON.stringify(settings));
    let cb = 0;
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      transformCallback: () => ++cb,
      unregisterCallback: () => {},
      convertFileSrc: (p) => 'http://127.0.0.1:1431/file?path=' + encodeURIComponent(p),
      invoke: async (cmd, args) => {
        // Native dialogs: answer with window.__dialogAnswer (set by a scenario step), default "cancel".
        if (cmd === 'plugin:dialog|message') {
          const b = args?.buttons;
          const [ok, cancel] = b?.OkCancelCustom ?? (b === 'YesNo' ? ['Yes', 'No'] : ['Ok', 'Cancel']);
          return window.__dialogAnswer ? ok : cancel;
        }
        const r = await fetch('http://127.0.0.1:1431/invoke', { method: 'POST', body: JSON.stringify({ cmd, args }) }).then((r) => r.json());
        if (r.error) throw r.error;
        if (cmd === 'search_folder') { for (const ev of r.result) args.onEvent.onmessage(ev); return null; }
        return r.result;
      },
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, sc.settings ?? null);
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, sc.startWait ?? 1500));

  const failed = [];
  for (const s of sc.actions ?? []) {
    if (s.keys) await page.keyboard.press(s.keys);
    if (s.chord) {
      // "Mod" is ⌘ on macOS and Ctrl elsewhere, like the app's CmdOrCtrl.
      const keys = s.chord.map((k) => (k === 'Mod' ? (process.platform === 'darwin' ? 'Meta' : 'Control') : k));
      for (const k of keys) await page.keyboard.down(k);
      for (const k of keys.reverse()) await page.keyboard.up(k);
    }
    if (s.click) await page.click(s.click);
    if (s.drag) {
      // Real mouse drag between the centers of two elements: [fromSelector, toSelector].
      const center = (sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      const [a, b] = [await center(s.drag[0]), await center(s.drag[1])];
      await page.mouse.move(...a);
      await page.mouse.down();
      await page.mouse.move(a[0] + 10, a[1] + 10, { steps: 3 });
      await page.mouse.move(...b, { steps: 8 });
      await page.mouse.up();
    }
    if (s.type) await page.keyboard.type(s.type, { delay: 5 });
    if (s.eval) await page.evaluate(s.eval).catch((e) => failed.push(`eval threw: ${e.message.split("\n")[0]}`));
    if (s.waitFor) {
      const ok = await page.waitForFunction(s.waitFor, { timeout: s.timeout ?? 15000 }).then(() => true, () => false);
      if (!ok) failed.push(`timed out waiting for ${s.waitFor}`);
    }
    await new Promise((r) => setTimeout(r, s.wait ?? (s.waitFor ? 300 : 600)));
    if (s.assert) {
      const ok = await page.evaluate(s.assert).catch((e) => `threw: ${e.message}`);
      if (ok !== true) failed.push(`${s.assert} → ${JSON.stringify(ok)}`);
    }
    if (s.shot) await page.screenshot({ path: path.join(OUT, `${name}-${s.shot}.png`) });
  }
  failed.push(...errors.map((e) => `page error: ${e}`));
  await withTimeout(page.close(), 5000, 'close').catch(() => {});
  return failed;
}

await withTimeout(browser.close(), 10000, 'browser close').catch(() => browser.process()?.kill('SIGKILL'));
server.close();
stopVite();
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
