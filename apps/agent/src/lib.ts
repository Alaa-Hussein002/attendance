/** Pure helpers (unit-tested). The device reports wall-clock time; we never convert it to UTC here — the server does, using the company timezone. */
export interface Punch { biometricId: string; time: string }

const p2 = (n: number) => String(n).padStart(2, '0');
/** node-zklib builds a local-timezone Date from the device's wall clock, so LOCAL getters give the device's own time. */
export const toNaive = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
export const daysAgoNaive = (now: Date, days: number) => toNaive(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 0, 0, 0));

/** Raw terminal rows -> punches newer than (or equal to) the last synced moment. Equal is kept; the server de-duplicates. */
export function newerThan(rows: { deviceUserId: string | number; recordTime: Date | string }[], since: string): Punch[] {
  return rows.map((r) => ({ biometricId: String(r.deviceUserId), time: r.recordTime instanceof Date ? toNaive(r.recordTime) : String(r.recordTime) }))
    .filter((p) => /^[A-Za-z0-9_-]{1,24}$/.test(p.biometricId) && p.time >= since).sort((a, b) => a.time.localeCompare(b.time));
}
export function chunk<T>(a: T[], n: number): T[][] { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

export interface Config { apiUrl: string; deviceKey: string; host: string; port: number; intervalSec: number; firstSyncDays: number }
export function readConfig(env: Record<string, string | undefined>): Config {
  const need = (k: string) => { const v = env[k]?.trim(); if (!v) throw new Error(`Missing ${k} in .env`); return v; };
  const port = Number(env.DEVICE_PORT ?? 4370); const interval = Number(env.INTERVAL_SEC ?? 60);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DEVICE_PORT is invalid');
  if (!(interval >= 15)) throw new Error('INTERVAL_SEC must be at least 15');
  const key = need('DEVICE_KEY'); if (!key.startsWith('bmk_') || key.length < 20) throw new Error('DEVICE_KEY looks wrong (it starts with bmk_)');
  return { apiUrl: need('API_URL').replace(/\/+$/, ''), deviceKey: key, host: need('DEVICE_HOST'), port, intervalSec: interval, firstSyncDays: Math.max(1, Number(env.FIRST_SYNC_DAYS ?? 35)) };
}
