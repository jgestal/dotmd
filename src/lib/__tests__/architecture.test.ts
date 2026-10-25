// The dependency rule of the layered architecture, enforced: inner layers never import outer ones.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const LIB = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = (dir: string) =>
  fs.readdirSync(path.join(LIB, dir)).filter((f: string) => f.endsWith('.ts')).map((f: string) => path.join(LIB, dir, f));
const imports = (file: string) => [...fs.readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);

const FRAMEWORK = [/^@tauri-apps\//, /^svelte/, /state\.svelte/, /i18n/, /container/, /\.svelte$/, /infrastructure\//];

describe('architecture', () => {
  it('domain depends on nothing but itself', () => {
    for (const f of files('domain')) {
      for (const i of imports(f)) expect(i.startsWith('./'), `${path.basename(f)} imports ${i}`).toBe(true);
    }
  });
  it('application depends only on domain and ports', () => {
    for (const f of files('application')) {
      for (const i of imports(f)) {
        expect(FRAMEWORK.some((r) => r.test(i)), `${path.basename(f)} imports ${i}`).toBe(false);
        expect(/^\.\.\/(domain|ports)\b|^\.\//.test(i), `${path.basename(f)} imports ${i}`).toBe(true);
      }
    }
  });
  it('ports are pure types', () => {
    for (const f of files('ports')) expect(imports(f)).toEqual([]);
  });
  it('only infrastructure calls Rust commands (invoke)', () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: any) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const offenders = walk(LIB)
      .filter((f) => /\.(ts|svelte)$/.test(f) && !f.includes('infrastructure') && !f.includes('__tests__'))
      .filter((f) => /\binvoke\s*[<(]/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(LIB, f))).toEqual([]);
  });
  it('only infrastructure talks to Tauri among the core modules', () => {
    for (const dir of ['domain', 'application', 'ports']) {
      for (const f of files(dir)) expect(fs.readFileSync(f, 'utf8')).not.toMatch(/invoke\(|@tauri-apps/);
    }
  });
});
