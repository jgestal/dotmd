// End-to-end tests of the real DotMD executable's command line (no mocks): help, version, single
// and batch exports, folder expansion and --merge. Needs a built binary (npm run build:debug) and,
// on Linux, a display (run under xvfb-run).
//   node tests/e2e/cli.mjs [path/to/dotmd]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXE = process.argv[2] ?? path.join(ROOT, 'src-tauri/target/debug', process.platform === 'win32' ? 'dotmd.exe' : 'dotmd');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dotmd-cli-'));
fs.cpSync(path.join(ROOT, 'tests/ui/fixtures'), path.join(work, 'docs'), { recursive: true });

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name}\n    ${String(e.message ?? e).split('\n').join('\n    ')}`);
  }
}
const run = (...args) => spawnSync(EXE, args, { cwd: work, encoding: 'utf8', timeout: 120000 });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const isPdf = (p) => fs.existsSync(p) && fs.readFileSync(p).subarray(0, 5).toString() === '%PDF-';
const pages = (p) => (fs.readFileSync(p).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

check('--help prints usage', () => {
  const r = run('--help');
  assert(r.status === 0 && r.stdout.includes('dotmd --export'), r.stdout + r.stderr);
});
check('--version prints the version', () => {
  const r = run('--version');
  assert(r.status === 0 && /^dotmd \d+\.\d+\.\d+/.test(r.stdout), r.stdout);
});
check('bad arguments exit with code 2', () => {
  const r = run('--export', 'docx', 'x.md');
  assert(r.status === 2 && r.stderr.includes('format'), `status ${r.status}: ${r.stderr}`);
});
check('exports one file to HTML next to it', () => {
  const r = run('--export', 'html', 'docs/README.md');
  const out = path.join(work, 'docs/README.html');
  assert(r.status === 0, r.stderr);
  const html = fs.readFileSync(out, 'utf8');
  assert(html.includes('<h1') && html.includes('DotMD demo') && html.includes('<svg'), 'missing heading or Mermaid SVG');
});
check('exports one file to PDF', () => {
  const r = run('--export', 'pdf', 'docs/long.md', '-o', 'long.pdf');
  const out = path.join(work, 'long.pdf');
  assert(r.status === 0 && isPdf(out), r.stderr);
  assert(pages(out) >= 3, `expected ≥3 pages, got ${pages(out)}`);
});
check('exports a folder to HTML, keeping sub-folders', () => {
  const r = run('--export', 'html', 'docs', '-o', 'site');
  assert(r.status === 0, r.stderr);
  for (const f of ['site/README.html', 'site/long.html', 'site/notes/second.html', 'site/data/people.html', 'site/data/hello.html']) {
    assert(fs.existsSync(path.join(work, f)), `missing ${f}`);
  }
  assert(fs.readFileSync(path.join(work, 'site/data/people.html'), 'utf8').includes('<table class="csv"'), 'CSV should export as a table');
  assert(fs.readFileSync(path.join(work, 'site/data/hello.html'), 'utf8').includes('hljs-keyword'), 'code should be highlighted');
});
check('merges several files into one PDF', () => {
  const r = run('--export', 'pdf', 'docs/README.md', 'docs/notes/second.md', '--merge', '-o', 'book.pdf');
  assert(r.status === 0 && isPdf(path.join(work, 'book.pdf')), r.stderr);
  assert(pages(path.join(work, 'book.pdf')) >= 2, 'merged PDF should have at least two pages');
});
check('missing input fails cleanly', () => {
  const r = run('--export', 'html', 'nope.md');
  assert(r.status === 1, `status ${r.status}`);
});

if (process.platform !== 'win32') {
  check('a second launch hands its file to the running instance', () => {
    const log = path.join(work, 'first.log');
    const first = spawnSync('sh', ['-c', `"${EXE}" docs/README.md >"${log}" 2>&1 & echo $!`], { cwd: work, encoding: 'utf8' });
    const pid = first.stdout.trim();
    const wait = (cond, ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; spawnSync('sleep', ['0.5']); } return false; };
    try {
      spawnSync('sleep', ['4']); // let the first instance start
      const t0 = Date.now();
      const second = run('docs/long.md');
      assert(second.status === 0 && Date.now() - t0 < 15000, `second launch did not exit quickly (status ${second.status})`);
      const handed = wait(() => fs.readFileSync(log, 'utf8').includes('second launch: opening') && fs.readFileSync(log, 'utf8').includes('long.md'), 10000);
      assert(handed, `running instance did not receive the file:\n${fs.readFileSync(log, 'utf8').slice(-800)}`);
    } finally {
      spawnSync('kill', [pid]);
    }
  });
}

fs.rmSync(work, { recursive: true, force: true });
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
