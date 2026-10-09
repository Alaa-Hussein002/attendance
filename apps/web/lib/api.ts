import { ApiError } from './errors';
import { session } from './session';

export const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function raw(path: string, method: string, body: unknown, token: string | null) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new ApiError('NETWORK_ERROR', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new ApiError(String(data?.code ?? msg ?? `HTTP_${res.status}`), res.status, data);
  }
  return data;
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  const rt = session.refresh(); if (!rt) return false;
  refreshing ??= raw('/auth/refresh', 'POST', { refreshToken: rt }, null)
    .then((r) => { session.setAccess(r.accessToken, r.refreshToken); return true; }).catch(() => false).finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  try { return await raw(path, method, body, auth ? session.access() : null); }
  catch (e) {
    if (auth && e instanceof ApiError && e.status === 401 && (await tryRefresh())) return raw(path, method, body, session.access());
    if (auth && e instanceof ApiError && e.status === 401) { session.clear(); if (typeof window !== 'undefined') window.location.href = '/login'; }
    throw e;
  }
}

/** Authenticated file download (a plain <a href> cannot send the Bearer header). */
export async function download(path: string, filename: string) {
  let res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${session.access()}` } });
  if (res.status === 401 && (await tryRefresh())) res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${session.access()}` } });
  if (!res.ok) throw new ApiError(`HTTP_${res.status}`, res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
