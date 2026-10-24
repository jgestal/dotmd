// UI test harness: runs the Svelte frontend in headless Chrome with a fake Tauri bridge.
// Rust commands are answered by this Node process; render_markdown uses the real comrak binary
// (src-tauri/examples/render.rs), so the HTML is exactly what the app renders.
//
//   node tests/ui/run.mjs                 # every scenario in tests/ui/scenarios
//   node tests/ui/run.mjs sounds tabs     # only these
//
// Scenario steps: eval, click, keys, chord (["Mod","Shift","KeyP"]), type, waitFor (JS condition), wait (ms), assert (must be true), shot.
//
// Env: CHROME_PATH (browser binary), UI_PORT (Vite port, default 1420). Screenshots go to tests/ui/out.
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
const PORT = Number(process.env.UI_PORT ?? 1420);
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

// Fixtures are copied so scenarios may write files freely.
const FIX = fs.mkdtempSync(path.join(os.tmpdir(), 'dotmd-ui-'));
fs.cpSync(path.join(HERE, 'fixtures'), FIX, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const TEXT = /\.(md|markdown|txt)$/i;
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
  rename_path: ({ from, to }) => (fs.renameSync(from, to), null),
  create_file: ({ path: p }) => (fs.writeFileSync(p, '', { flag: 'wx' }), null),
  save_asset: ({ dir, name, bytes }) => {
    const d = path.join(dir, 'assets');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, name), Buffer.from(bytes));
    return 'assets/' + name;
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
let vite = null;
if (!(await viteUp())) {
  vite = spawn('npx', ['vite', 'dev', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
  for (let i = 0; i < 120 && !(await viteUp()); i++) await new Promise((r) => setTimeout(r, 500));
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--no-first-run', '--window-size=1280,860', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
  defaultViewport: { width: 1280, height: 860, deviceScaleFactor: 1 },
});

const wanted = process.argv.slice(2);
const files = fs.readdirSync(path.join(HERE, 'scenarios')).filter((f) => f.endsWith('.json'))
  .filter((f) => !wanted.length || wanted.includes(f.replace(/\.json$/, '')));
let failures = 0;

for (const file of files) {
  const name = file.replace(/\.json$/, '');
  const sc = JSON.parse(fs.readFileSync(path.join(HERE, 'scenarios', file), 'utf8').replaceAll('$FIX', FIX.replaceAll('\\', '/')));
  pendingOpen = sc.open ? [sc.open] : [];
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
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
        const r = await fetch('http://127.0.0.1:1431/invoke', { method: 'POST', body: JSON.stringify({ cmd, args }) }).then((r) => r.json());
        if (r.error) throw r.error;
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
  console.log(`${failed.length ? '✗' : '✓'} ${name}`);
  for (const f of failed) console.log('    ' + f);
  failures += failed.length ? 1 : 0;
  await page.close();
}

await browser.close();
server.close();
vite?.kill();
fs.rmSync(FIX, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
