export interface PromptField {
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
}

interface Request {
  title: string;
  fields: PromptField[];
  values: Record<string, string>;
  resolve: (v: Record<string, string> | null) => void;
}

export const prompt = $state({ req: null as Request | null });

/** In-app form dialog (the webview has no native window.prompt). */
export function askFields(title: string, fields: PromptField[]): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    prompt.req = {
      title,
      fields,
      values: Object.fromEntries(fields.map((f) => [f.key, f.value ?? ''])),
      resolve: (v) => {
        prompt.req = null;
        resolve(v);
      },
    };
  });
}
