'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const blank = { name: '', email: '', password: '', branchId: '', baseSalary: '' };

export default function Employees() {
  const [rows, setRows] = useState<any[]>([]); const [branches, setBranches] = useState<any[]>([]);
  const [f, setF] = useState(blank); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const load = () => Promise.all([api<any[]>('/employees'), api<any[]>('/branches')]).then(([e, b]) => { setRows(e); setBranches(b); }).catch((x) => setErr(x.message));
  useEffect(() => { load(); }, []);
  const run = async (fn: () => Promise<unknown>, ok = '') => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); load(); } catch (e: any) { setErr(e.message); } };
  const patch = (id: string, k: string, v: unknown) => setRows((r) => r.map((x) => (x.id === id ? { ...x, [k]: v } : x)));

  const create = () => run(async () => {
    await api('/employees', { method: 'POST', body: { name: f.name, email: f.email, password: f.password, branchId: f.branchId || undefined, baseSalary: f.baseSalary === '' ? 0 : Number(f.baseSalary) } });
    setF(blank);
  }, 'تمت الإضافة');
  const save = (u: any) => run(() => api(`/employees/${u.id}`, { method: 'PUT', body: { name: u.name, branchId: u.branchId || null, baseSalary: Number(u.baseSalary), active: u.active } }), 'تم الحفظ');
  const resetDevice = (u: any) => { const reason = window.prompt(`سبب إعادة ضبط جهاز ${u.name}؟`); if (reason) run(() => api(`/employees/${u.id}/reset-device`, { method: 'POST', body: { reason } }), 'تمت إعادة ضبط الجهاز'); };

  return (<>
    <h1>الموظفون</h1>{err && <div className="errors">{err}</div>}{msg && <p className="hint">{msg}</p>}
    <div className="card"><h2>موظف جديد</h2><div className="row">
      {(['name', 'email', 'password'] as const).map((k) => <div key={k}><label>{{ name: 'الاسم', email: 'البريد', password: 'كلمة المرور (10 أحرف فأكثر)' }[k]}</label>
        <input type={k === 'password' ? 'password' : 'text'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
      <div><label>الفرع</label><select value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      <div><label>الراتب الأساسي (ريال)</label><input type="number" min={0} value={f.baseSalary} onChange={(e) => setF({ ...f, baseSalary: e.target.value })} /></div>
      <button className="primary" onClick={create}>إضافة</button></div></div>
    <div className="card scroll"><table><thead><tr><th>الاسم</th><th>الدور</th><th>الفرع</th><th>الراتب (ريال)</th><th>نشط</th><th /></tr></thead><tbody>
      {rows.map((u) => <tr key={u.id}><td>{u.name}<div className="hint">{u.email}</div></td><td>{u.role}</td>
        <td><select value={u.branchId ?? ''} onChange={(e) => patch(u.id, 'branchId', e.target.value)}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></td>
        <td>{u.baseSalary !== undefined ? <input type="number" min={0} value={u.baseSalary} onChange={(e) => patch(u.id, 'baseSalary', e.target.value)} /> : '—'}</td>
        <td><input type="checkbox" checked={u.active} onChange={(e) => patch(u.id, 'active', e.target.checked)} /></td>
        <td style={{ display: 'flex', gap: 6 }}><button onClick={() => save(u)}>حفظ</button>{u.role === 'EMPLOYEE' && <button onClick={() => resetDevice(u)}>إعادة ضبط الجهاز</button>}</td></tr>)}
    </tbody></table></div></>);
}
