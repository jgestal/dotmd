// `dotmd --export pdf|html <inputs…> [-o out] [--merge]`: renders with the user's settings, writes the
// files and quits without ever showing the window. Folders are expanded to the documents inside.
import { services } from './container';
import { settings } from './state.svelte';
import { currentTheme } from './appearance.svelte';
import { exportHtmlFile, exportPdfFile, exportSlidesFile, exportTheme } from './export';
import { basename, dirname, extname, join, relative, stem } from './path';
import { exportStyleTheme } from './themes';

export interface CliExport { format: 'pdf' | 'html'; inputs: string[]; output: string | null; merge: boolean; slides?: boolean; style?: string | null }

/** Expands folders, and maps each input to its output path. Pure, so it is unit-tested. */
export function planOutputs(files: { path: string; root: string | null }[], job: CliExport, outIsDir: boolean): { input: string; output: string }[] {
  const ext = job.format;
  return files.map(({ path, root }) => {
    if (job.output && !outIsDir) return { input: path, output: job.output };
    const name = `${stem(path)}.${ext}`;
    if (!job.output) return { input: path, output: join(dirname(path), name) };
    // Inside an exported folder, keep the sub-folder structure.
    const sub = root ? dirname(relative(root, path)) : '.';
    return { input: path, output: join(job.output, sub === '.' || sub === '' ? name : `${sub}/${name}`) };
  });
}

async function expand(inputs: string[]): Promise<{ path: string; root: string | null }[]> {
  const out: { path: string; root: string | null }[] = [];
  for (const p of inputs) {
    const kind = await services.fs.kind(p);
    if (kind === 'dir') for (const f of await services.fs.listTree(p)) out.push({ path: f, root: p });
    else if (kind === 'file') out.push({ path: p, root: null });
    else throw new Error(`not found: ${p}`);
  }
  return out;
}

export async function runCliExport(): Promise<boolean> {
  const job = await services.process.takeCliExport<CliExport>();
  if (!job) return false;
  let code = 0;
  try {
    await document.fonts.ready;
    const files = await expand(job.inputs);
    if (!files.length) throw new Error('no documents found');
    const theme = job.style ? exportStyleTheme(job.style, currentTheme()) : exportTheme(currentTheme());
    const o = { theme, pageSize: settings.pdfPageSize, margin: settings.pdfMargin, toc: job.merge };
    const noEngine = (ok: boolean) => { if (!ok) throw new Error('no PDF engine available'); };
    const write = (docs: { md: string; path: string }[], out: string) =>
      job.slides ? exportSlidesFile(docs[0].md, docs[0].path, out, o.theme).then(noEngine)
      : job.format === 'html' ? exportHtmlFile(docs, out, o) : exportPdfFile(docs, out, o).then(noEngine);
    const read = async (path: string) => ({ md: await services.fs.readText(path), path });

    if (job.merge) {
      await write(await Promise.all(files.map((f) => read(f.path))), job.output!);
      console.warn(`exported ${files.length} documents into ${job.output}`);
    } else {
      // A single input with an output that has the right extension is a file; anything else a folder.
      const outIsDir = !!job.output && !(files.length === 1 && extname(job.output) === job.format);
      for (const { input, output } of planOutputs(files, job, outIsDir)) {
        await write([await read(input)], output);
        console.warn(`exported ${basename(input)} → ${output}`);
      }
    }
  } catch (e) {
    console.error('export failed:', e);
    code = 1;
  }
  await services.process.quit(code);
  return true;
}
