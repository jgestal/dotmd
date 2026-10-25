// One error type for the whole app, so failures are handled and reported in one predictable way.

export type ErrorCode = 'binary' | 'exists' | 'not-found' | 'permission' | 'cancelled' | 'no-engine' | 'io';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly path?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Maps anything thrown (Rust command strings, DOM errors, AppErrors) to an AppError. */
export function toAppError(e: unknown, path?: string): AppError {
  if (e instanceof AppError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  const code: ErrorCode =
    msg === 'binary' ? 'binary'
    : msg === 'exists' || lower.includes('already exists') ? 'exists'
    : msg === 'no-engine' ? 'no-engine'
    : lower.includes('no such file') || lower.includes('not found') || lower.includes('cannot find') ? 'not-found'
    : lower.includes('permission denied') || lower.includes('access is denied') ? 'permission'
    : 'io';
  return new AppError(code, msg, path);
}

/** Translation key and variables for an error message shown to the user. */
export function errorMessage(e: AppError, name: string): { key: string; vars: Record<string, string> } {
  switch (e.code) {
    case 'binary': return { key: 'toast.binary', vars: { name } };
    case 'exists': return { key: 'toast.exists', vars: { name } };
    default: return { key: 'toast.error', vars: { msg: e.message } };
  }
}
