export class ApiError extends Error { constructor(public code: string, public status: number, public data?: any) { super(code); } }

/** Resolve an error to a user-facing message in the active language. */
export const errText = (e: unknown, t: (key: string) => string): string => {
  if (e instanceof ApiError && e.code) {
    const key = `err.${e.code}`;
    const text = t(key);
    // A missing code must degrade to a readable sentence, never a raw dictionary key.
    if (text !== key) return text;
  }
  return t('common.generic_error');
};
