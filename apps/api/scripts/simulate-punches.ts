// Pretends to be the fingerprint agent (no hardware needed). Employees 1..N must exist (npm run demo:data) and a device key from the web panel.
//   API_URL=http://localhost:3000 DEVICE_KEY=bmk_... npm run demo:punches -w @attendance/api -- 50
import { mulberry32 } from './demo-lib';

const API = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, ''); const KEY = process.env.DEVICE_KEY ?? ''; const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 20);
if (!KEY.startsWith('bmk_')) { console.error('Set DEVICE_KEY=bmk_... (shown once when you add the device in Settings → Fingerprint devices)'); process.exit(1); }
const pad = (n: number) => String(n).padStart(2, '0'); const d = new Date(); const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rng = mulberry32(42); const at = (m: number) => `${day} ${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`;
// mix: on time, late, after the cut-off (no attendance), a duplicate "leaving" punch, an unknown fingerprint id
const punches: { biometricId: string; time: string }[] = [];
for (let i = 1; i <= N; i++) { const k = i % 5; const m = k === 0 ? 10 * 60 + 20 + Math.floor(rng() * 60) : k === 4 ? 12 * 60 + 30 : 9 * 60 + 45 + Math.floor(rng() * 25); punches.push({ biometricId: String(i), time: at(m) }); if (k === 1) punches.push({ biometricId: String(i), time: at(17 * 60 + 5) }); }
punches.push({ biometricId: '9999', time: at(9 * 60 + 50) });
const post = async (path: string, body: object) => { const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-device-key': KEY }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j)}`); return j; };
(async () => {
  await post('/agent/heartbeat', { deviceTime: at(d.getHours() * 60 + d.getMinutes()) });
  const r = await post('/agent/punches', { punches }); console.log(`أُرسلت ${punches.length} بصمة →`, r, '\nأعد تشغيل نفس الأمر: يجب أن تظهر كلها repeated (لا تكرار).');
})().catch((e) => { console.error(e.message); process.exit(1); });
