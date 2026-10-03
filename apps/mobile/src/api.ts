import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const K = { access: 'at', refresh: 'rt', device: 'dev' };

/** Stable per-install id. A reinstall creates a new one, which triggers the OTP device-change flow (by design). */
export async function getDeviceUid() {
  let d = await SecureStore.getItemAsync(K.device);
  if (!d) { d = Crypto.randomUUID(); await SecureStore.setItemAsync(K.device, d); }
  return d;
}
export class ApiError extends Error { constructor(public code: string, public status: number, public body?: any) { super(code); } }

export async function saveSession(r: { accessToken: string; refreshToken: string }) {
  await SecureStore.setItemAsync(K.access, r.accessToken); await SecureStore.setItemAsync(K.refresh, r.refreshToken);
}
export const hasSession = async () => !!(await SecureStore.getItemAsync(K.refresh));
export async function clearSession() { await SecureStore.deleteItemAsync(K.access); await SecureStore.deleteItemAsync(K.refresh); }

async function raw(path: string, method: string, body: unknown, token?: string | null) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(String(data?.code ?? (Array.isArray(data?.message) ? data.message[0] : data?.message) ?? `HTTP_${res.status}`), res.status, data);
  return data;
}

async function refresh() {
  const rt = await SecureStore.getItemAsync(K.refresh);
  if (!rt) throw new ApiError('SESSION_EXPIRED', 401);
  try { const r = await raw('/auth/refresh', 'POST', { refreshToken: rt, deviceUid: await getDeviceUid() }); await saveSession(r); }
  catch { await clearSession(); throw new ApiError('SESSION_EXPIRED', 401); }
}

export async function request<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  if (!auth) return raw(path, method, body);
  try { return await raw(path, method, body, await SecureStore.getItemAsync(K.access)); }
  catch (e) {
    if (e instanceof ApiError && e.status === 401) { await refresh(); return raw(path, method, body, await SecureStore.getItemAsync(K.access)); }
    throw e;
  }
}
