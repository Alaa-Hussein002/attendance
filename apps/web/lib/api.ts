const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
// NOTE: sessionStorage is acceptable for the MVP; move tokens to httpOnly cookies (BFF) before production.
export const tokens = {
  get: () => (typeof window === 'undefined' ? null : sessionStorage.getItem('at')),
  set: (t: string) => sessionStorage.setItem('at', t),
  clear: () => sessionStorage.removeItem('at'),
};

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(tokens.get() ? { Authorization: `Bearer ${tokens.get()}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && path !== '/auth/login') { tokens.clear(); window.location.href = '/login'; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.errors?.join?.('، ') ?? data?.message ?? data?.code ?? `HTTP ${res.status}`);
  return data as T;
}

/** Authenticated file download (the Bearer header cannot be sent by a plain <a href>). */
export async function download(path: string, filename: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${tokens.get()}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
export const sar = (minorOrDecimal: number) => minorOrDecimal.toFixed(2);
