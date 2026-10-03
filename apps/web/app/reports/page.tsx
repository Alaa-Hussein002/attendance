'use client';
import { useState } from 'react';
import { api, download } from '../../lib/api';

const NEUTRAL: Record<string, string> = { HOLIDAY: '#94a3b8', WEEKEND: '#cbd5e1', ON_LEAVE: '#60a5fa', EXCUSED: '#a78bfa', FUTURE: 'transparent' };
const r2 = (m: number) => (m / 100).toFixed(2);

export default function Reports() {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear()); const [m, setM] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any[] | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  async function load() { setBusy(true); setErr(''); try { setData(await api(`/reports/monthly?year=${y}&month=${m}`)); } catch (e: any) { setErr(e.message); } setBusy(false); }
  async function csv() { try { await download(`/reports/payroll.csv?year=${y}&month=${m}`, `payroll-${y}-${String(m).padStart(2, '0')}.csv`); } catch (e: any) { setErr(e.message); } }
  async function close() {
    if (!window.confirm('إقفال الشهر يحفظ لقطة ثابتة للنتائج. متابعة؟')) return;
    try { const r = await api('/reports/close', { method: 'POST', body: { year: y, month: m } }); window.alert(`تم إقفال ${r.closed} موظف`); } catch (e: any) { setErr(e.message); }
  }
  const color = (c: any, d: any) => { const tiers = [...c.policy.tiers, c.policy.absentTier]; return tiers.find((t: any) => t.key === d.status)?.color ?? NEUTRAL[d.status] ?? '#999'; };
  const totals = (data ?? []).reduce((a, c) => a + c.row.netSalaryMinor, 0);

  return (<>
    <h1>التقارير وكشف الرواتب</h1>{err && <div className="errors">{err}</div>}
    <div className="card"><div className="row">
      <div><label>السنة</label><input type="number" value={y} onChange={(e) => setY(Number(e.target.value))} /></div>
      <div><label>الشهر</label><input type="number" min={1} max={12} value={m} onChange={(e) => setM(Number(e.target.value))} /></div>
      <button className="primary" disabled={busy} onClick={load}>عرض</button>
      <button disabled={!data} onClick={csv}>تصدير CSV</button><button disabled={!data} onClick={close}>إقفال الشهر</button></div></div>
    {data && <div className="card scroll"><table><thead><tr><th>الموظف</th><th>أيام الشهر</th><th>في الوقت</th><th>تأخر</th><th>غياب</th><th>معوَّض</th><th>خصومات</th><th>مكافأة</th><th>الصافي</th></tr></thead><tbody>
      {data.map((c) => <tr key={c.userId}><td>{c.name}</td>
        <td><div className="dots">{c.result.days.map((d: any) => <i key={d.date} title={`${d.date}: ${d.status}${d.redeemed ? ' (معوَّض)' : ''}`}
          style={{ background: color(c, d), outline: d.redeemed ? '2px solid var(--brand)' : d.status === 'FUTURE' ? '1px solid var(--line)' : 'none' }} />)}</div></td>
        <td className="num">{c.row.onTimeDays}</td><td className="num">{c.row.lateDays}</td><td className="num">{c.row.absentDays}</td><td className="num">{c.row.redeemedDays}</td>
        <td className="num neg">{r2(c.row.lateDeductionsMinor + c.row.absentDeductionsMinor)}</td><td className="num">{r2(c.row.bonusMinor)}</td><td className="num"><b>{r2(c.row.netSalaryMinor)}</b></td></tr>)}
      <tr><td colSpan={8}><b>الإجمالي</b></td><td className="num"><b>{r2(totals)}</b></td></tr></tbody></table>
      <p className="hint">الدائرة بإطار = يوم سيئ تم تعويضه. الأرقام بالريال.</p></div>}
  </>);
}
