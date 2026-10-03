'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function Holidays() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<any[]>([]); const [f, setF] = useState({ date: '', name: '' }); const [err, setErr] = useState('');
  const load = () => api<any[]>(`/holidays?year=${year}`).then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [year]);
  const run = async (fn: () => Promise<unknown>) => { setErr(''); try { await fn(); load(); } catch (e: any) { setErr(e.message); } };
  return (<>
    <h1>العطل الرسمية</h1>{err && <div className="errors">{err}</div>}
    <p className="hint">العطل لا تُحتسب غياباً ولا تأخراً لأي موظف.</p>
    <div className="card"><div className="row">
      <div><label>السنة</label><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
      <div><label>التاريخ</label><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      <div><label>الاسم</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <button className="primary" onClick={() => run(async () => { await api('/holidays', { method: 'POST', body: f }); setF({ date: '', name: '' }); })}>إضافة</button></div></div>
    <div className="card scroll"><table><tbody>{rows.map((h) => <tr key={h.id}><td className="num">{h.date}</td><td>{h.name}</td>
      <td><button onClick={() => window.confirm('حذف هذه العطلة؟') && run(() => api(`/holidays/${h.id}`, { method: 'DELETE' }))}>حذف</button></td></tr>)}</tbody></table>
      {!rows.length && <p className="hint">لا توجد عطل لهذه السنة.</p>}</div></>);
}
