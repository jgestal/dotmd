// Forwards frontend warnings and errors to the Rust log (visible in the terminal running the app).
import { error, warn } from '@tauri-apps/plugin-log';

const fmt = (args: unknown[]) => args.map((a) => (a instanceof Error ? a.stack ?? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');

export function forwardConsole() {
  if (!('__TAURI_INTERNALS__' in window)) return;
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  console.warn = (...a: unknown[]) => { origWarn(...a); void warn(fmt(a)).catch(() => {}); };
  console.error = (...a: unknown[]) => { origError(...a); void error(fmt(a)).catch(() => {}); };
  window.addEventListener('error', (e) => void error(`${e.message} @ ${e.filename}:${e.lineno}`).catch(() => {}));
  window.addEventListener('unhandledrejection', (e) => void error(`unhandled rejection: ${fmt([e.reason])}`).catch(() => {}));
}
