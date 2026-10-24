import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { app, settings, toast } from './state.svelte';
import { t } from './i18n';
import { dirname, join, relative, stem } from './path';
import { currentTheme } from './appearance.svelte';
import { exportHtmlFile, exportPdfFile, exportTheme, type ExportOptions } from './export';

export type Format = 'pdf' | 'html';

export interface BatchJob {
  files: string[];
  formats: Format[];
  merge: boolean;
  outDir: string | null;
  toc: boolean;
}

function options(toc: boolean): ExportOptions {
  return { theme: exportTheme(currentTheme()), pageSize: settings.pdfPageSize, margin: settings.pdfMargin, toc };
}

async function readDoc(path: string): Promise<{ md: string; path: string }> {
  // The open document may have unsaved edits: export what the user sees.
  if (path === app.path) return { md: app.content, path };
  return { md: await invoke<string>('read_text', { path }), path };
}

function fallbackPrint() {
  toast(t('toast.noEngine'), 5000);
  app.mode = 'preview';
  setTimeout(() => window.print(), 400);
}

export const exportRequest = $state({
  running: false,
  done: 0,
  total: 0,
  errors: [] as string[],
  cancelled: false,

  /** Single file via a native Save dialog (context menu, toolbar). */
  async quick(path: string | null, format: Format) {
    const base = path ? join(dirname(path), stem(path)) : (app.root ? join(app.root, t('top.untitled')) : t('top.untitled'));
    const out = await save({ defaultPath: `${base}.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
    if (!out) return;
    try {
      const doc = path ? await readDoc(path) : { md: app.content, path: null };
      if (format === 'html') await exportHtmlFile([doc], out, options(false));
      else if (!(await exportPdfFile([doc], out, options(false)))) return fallbackPrint();
      toast(t('toast.exported', { n: 1 }));
    } catch (e) {
      toast(t('toast.error', { msg: String(e) }), 5000);
    }
  },

  async run(job: BatchJob) {
    this.running = true;
    this.cancelled = false;
    this.errors = [];
    this.done = 0;
    const base = app.root ?? (job.files[0] ? dirname(job.files[0]) : '');
    const target = (file: string, ext: Format) => {
      if (!job.outDir) return join(dirname(file), `${stem(file)}.${ext}`);
      const rel = relative(base, file).replace(/\.[^./\\]+$/, '');
      return join(job.outDir, `${rel.startsWith('..') ? stem(file) : rel}.${ext}`);
    };
    const opts = options(job.toc);
    let noEngine = false;
    try {
      if (job.merge) {
        this.total = job.formats.length;
        const docs = [];
        for (const f of job.files) docs.push(await readDoc(f));
        const outBase = join(job.outDir ?? base, app.root ? stem(app.root) || 'merged' : 'merged');
        for (const fmt of job.formats) {
          if (this.cancelled) break;
          if (fmt === 'html') await exportHtmlFile(docs, `${outBase}.html`, opts);
          else if (!(await exportPdfFile(docs, `${outBase}.pdf`, opts))) noEngine = true;
          this.done++;
        }
      } else {
        this.total = job.files.length * job.formats.length;
        for (const file of job.files) {
          for (const fmt of job.formats) {
            if (this.cancelled) break;
            try {
              const doc = await readDoc(file);
              if (fmt === 'html') await exportHtmlFile([doc], target(file, 'html'), opts);
              else if (!noEngine && !(await exportPdfFile([doc], target(file, 'pdf'), opts))) noEngine = true;
            } catch (e) {
              this.errors.push(`${file}: ${e}`);
            }
            this.done++;
          }
        }
      }
    } catch (e) {
      this.errors.push(String(e));
    } finally {
      this.running = false;
    }
    if (noEngine) toast(t('toast.noEngine'), 6000);
    else if (!this.errors.length) toast(t('toast.exported', { n: this.done }));
    return !this.errors.length;
  },
});
