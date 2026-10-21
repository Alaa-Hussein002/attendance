import 'dotenv/config';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import ZKLib from 'node-zklib';
import { chunk, Config, daysAgoNaive, newerThan, readConfig, readDeviceTime, toNaive } from './lib';

const REQUEST_TIMEOUT_MS = 15000;

/** One state file per terminal: two agents must never share a watermark. */
const STATE = `agent-state-${(process.env.DEVICE_HOST ?? 'device').replace(/[^\w.-]/g, '_')}.json`;
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const loadState = (): { lastSynced?: string } => { try { return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {}; } catch { return {}; } };
/** Written through a temp file so a crash mid-write cannot corrupt the watermark. */
const saveState = (v: { lastSynced: string }) => { const tmp = `${STATE}.tmp`; writeFileSync(tmp, JSON.stringify(v)); renameSync(tmp, STATE); };

async function post(cfg: Config, path: string, body: unknown) {
  // Without a timeout an unreachable server freezes the poll loop forever.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.apiUrl}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-device-key': cfg.deviceKey },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path} -> ${res.status} ${data?.message ?? ''}`);
    return data;
  } finally { clearTimeout(timer); }
}

async function syncOnce(cfg: Config) {
  const zk = new ZKLib(cfg.host, cfg.port, 10000, 4000);
  let rows: Awaited<ReturnType<ZKLib['getAttendances']>>['data'] = []; let deviceTime: Date | null = null;
  try { await zk.createSocket(); deviceTime = await readDeviceTime(zk); rows = (await zk.getAttendances()).data ?? []; }
  finally { await zk.disconnect().catch(() => {}); } // release the terminal between reads so other software can use it
  // deviceTime is best-effort: when the terminal cannot report its clock we still sync the punches.
  await post(cfg, '/agent/heartbeat', deviceTime ? { deviceTime: toNaive(deviceTime) } : {});

  const state = loadState(); const since = state.lastSynced ?? daysAgoNaive(new Date(), cfg.firstSyncDays);
  const punches = newerThan(rows, since); if (!punches.length) { log(`device ok, ${rows.length} records on it, nothing new`); return; }
  const totals: Record<string, number> = {};
  for (const part of chunk(punches, 200)) { const r = await post(cfg, '/agent/punches', { punches: part }); for (const [k, v] of Object.entries(r)) totals[k] = (totals[k] ?? 0) + Number(v); }
  saveState({ lastSynced: punches[punches.length - 1].time });
  log(`sent ${punches.length} punches`, totals);
}

async function main() {
  const cfg = readConfig(process.env);
  log(`agent started: device ${cfg.host}:${cfg.port} -> ${cfg.apiUrl}, every ${cfg.intervalSec}s`);
  for (;;) {
    try { await syncOnce(cfg); } catch (e: any) { log('sync failed (will retry):', e?.message ?? e); }
    await new Promise((r) => setTimeout(r, cfg.intervalSec * 1000));
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
