'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const STATUS: Record<string, string> = { PENDING: 'بانتظار القرار', APPROVED: 'موافق عليها', REJECTED: 'مرفوضة' };

export default function Leaves() {
  const [leaves, setLeaves] = useState<any[]>([]); const [emps, setEmps] = useState<any[]>([]);
  const [ex, setEx] = useState({ userId: '', date: '', reason: '' });
  const [man, setMan] = useState({ userId: '', date: '', time: '', reason: '' });
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const load = () => Promise.all([api<any[]>('/leaves'), api<any[]>('/employees')]).then(([l, e]) => { setLeaves(l); setEmps(e.filter((x) => x.role === 'EMPLOYEE')); }).catch((x) => setErr(x.message));
  useEffect(() => { load(); }, []);
  const name = (id: string) => emps.find((e) => e.id === id)?.name ?? id.slice(0, 8);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); load(); } catch (e: any) { setErr(e.message); } };
  const pick = (v: string, set: (s: string) => void) => <select value={v} onChange={(e) => set(e.target.value)}><option value="">— اختر الموظف —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>;

  return (<>
    <h1>الإجازات والأعذار</h1>{err && <div className="errors">{err}</div>}{msg && <p className="hint">{msg}</p>}
    <div className="card scroll"><h2>طلبات الإجازة</h2><table><thead><tr><th>الموظف</th><th>من</th><th>إلى</th><th>السبب</th><th>الحالة</th><th /></tr></thead><tbody>
      {leaves.map((l) => <tr key={l.id}><td>{name(l.userId)}</td><td className="num">{l.fromDate}</td><td className="num">{l.toDate}</td><td>{l.reason ?? '—'}</td><td>{STATUS[l.status]}</td>
        <td style={{ display: 'flex', gap: 6 }}>{l.status === 'PENDING' && <>
          <button className="primary" onClick={() => run(() => api(`/leaves/${l.id}/decision`, { method: 'POST', body: { approve: true } }), 'تمت الموافقة')}>موافقة</button>
          <button onClick={() => run(() => api(`/leaves/${l.id}/decision`, { method: 'POST', body: { approve: false } }), 'تم الرفض')}>رفض</button></>}</td></tr>)}</tbody></table>
      {!leaves.length && <p className="hint">لا توجد طلبات.</p>}</div>

    <div className="card"><h2>إعفاء يوم (عذر مقبول)</h2><p className="hint">يُحوَّل اليوم المتأخر أو الغائب إلى يوم محايد بلا خصم. السبب إلزامي ويُسجَّل.</p>
      <div className="row"><div><label>الموظف</label>{pick(ex.userId, (v) => setEx({ ...ex, userId: v }))}</div>
        <div><label>التاريخ</label><input type="date" value={ex.date} onChange={(e) => setEx({ ...ex, date: e.target.value })} /></div>
        <div><label>السبب</label><input value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} /></div>
        <button className="primary" onClick={() => run(() => api('/attendance/excuse', { method: 'POST', body: ex }), 'تم الإعفاء')}>إعفاء</button></div></div>

    <div className="card"><h2>تسجيل حضور يدوي</h2><p className="hint">للحالات الاستثنائية (تعطل الجوال مثلاً). الحالة تُحسب من سياسة الموظف، والسبب إلزامي.</p>
      <div className="row"><div><label>الموظف</label>{pick(man.userId, (v) => setMan({ ...man, userId: v }))}</div>
        <div><label>التاريخ</label><input type="date" value={man.date} onChange={(e) => setMan({ ...man, date: e.target.value })} /></div>
        <div><label>وقت الحضور</label><input type="time" value={man.time} onChange={(e) => setMan({ ...man, time: e.target.value })} /></div>
        <div><label>السبب</label><input value={man.reason} onChange={(e) => setMan({ ...man, reason: e.target.value })} /></div>
        <button className="primary" onClick={() => run(() => api('/attendance/manual', { method: 'POST', body: man }), 'تم التسجيل')}>تسجيل</button></div></div></>);
}
