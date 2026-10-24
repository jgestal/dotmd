// `dotmd --export pdf|html <input> <output>`: renders the document with the user's settings,
// writes the file and quits without ever showing the window.
import { invoke } from '@tauri-apps/api/core';
import { settings } from './state.svelte';
import { currentTheme } from './appearance.svelte';
import { exportHtmlFile, exportPdfFile, exportTheme } from './export';

interface CliExport { format: string; input: string; output: string }

export async function runCliExport(): Promise<boolean> {
  const job = await invoke<CliExport | null>('take_cli_export');
  if (!job) return false;
  let code = 0;
  try {
    await document.fonts.ready;
    const md = await invoke<string>('read_text', { path: job.input });
    const o = { theme: exportTheme(currentTheme()), pageSize: settings.pdfPageSize, margin: settings.pdfMargin, toc: false };
    const docs = [{ md, path: job.input }];
    if (job.format === 'html') await exportHtmlFile(docs, job.output, o);
    else if (!(await exportPdfFile(docs, job.output, o))) throw new Error('no PDF engine available');
    console.warn(`exported ${job.output}`);
  } catch (e) {
    console.error('export failed:', e);
    code = 1;
  }
  await invoke('quit', { code });
  return true;
}
