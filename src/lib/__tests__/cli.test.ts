import { describe, expect, it, vi } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), convertFileSrc: (p: string) => p }));
import { planOutputs, type CliExport } from '../cli';

const job = (o: Partial<CliExport>): CliExport => ({ format: 'pdf', inputs: [], output: null, merge: false, ...o });

describe('planOutputs', () => {
  it('writes next to each input by default', () => {
    expect(planOutputs([{ path: '/d/a.md', root: null }], job({}), false)).toEqual([{ input: '/d/a.md', output: '/d/a.pdf' }]);
  });
  it('uses an explicit output file for one input', () => {
    expect(planOutputs([{ path: '/d/a.md', root: null }], job({ output: '/x/book.pdf' }), false)[0].output).toBe('/x/book.pdf');
  });
  it('mirrors folder structure into an output folder', () => {
    const out = planOutputs(
      [{ path: '/docs/intro.md', root: '/docs' }, { path: '/docs/guide/setup.md', root: '/docs' }, { path: '/other/x.md', root: null }],
      job({ format: 'html', output: '/site' }),
      true,
    ).map((p) => p.output);
    expect(out).toEqual(['/site/intro.html', '/site/guide/setup.html', '/site/x.html']);
  });
});
