'use client';
import { useCallback, useEffect, useState } from 'react';
import { useDialog, useToast } from '../../components/Providers';
import { Field, PageHeader, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { ROLE_AR } from '../../lib/format';
import { session } from '../../lib/session';

const STAFF_ROLES = ['PHOTOGRAPHER', 'EMPLOYEE', 'TEAM_LEAD', 'BRANCH_MANAGER'];
const blank = { id: '', name: '', email: '', phone: '', role: 'PHOTOGRAPHER', branchId: '', baseSalary: '', biometricId: '', tracksAttendance: true, active: true };

export default function Employees() {
  const toast = useToast(); const { confirm, ask } = useDialog();
  const isAdmin = session.user()?.role === 'COMPANY_ADMIN';
  const roles = isAdmin ? [...STAFF_ROLES, 'HR', 'COMPANY_ADMIN'] : STAFF_ROLES;
  const [rows, setRows] = useState<any[]>([]); const [branches, setBranches] = useState<any[]>([]); const [f, setF] = useState(blank); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const load = useCallback(() => Promise.all([api<any[]>('/employees'), api<any[]>('/branches')]).then(([e, b]) => { setRows(e); setBranches(b); }).catch((x) => toast.error('تعذر التحميل', errText(x))), [toast]);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      const body = { name: f.name, email: f.email, phone: f.phone || undefined, role: f.role, branchId: f.branchId || (f.id ? null : undefined), baseSalary: f.baseSalary === '' ? 0 : Number(f.baseSalary), biometricId: f.biometricId || (f.id ? null : undefined), tracksAttendance: f.tracksAttendance, ...(f.id ? { active: f.active } : {}) };
      if (f.id) { const { email: _e, ...upd } = body; await api(`/employees/${f.id}`, { method: 'PUT', body: upd }); toast.success('تم حفظ بيانات الموظف'); }
      else { await api('/employees', { method: 'POST', body }); toast.success('تمت إضافة الموظف', 'كلمة المرور المبدئية 12345678، وسيغيّرها عند أول دخول بعد تأكيد بريده'); }
      setF(blank); setOpen(false); load();
    } catch (e) { toast.error('تعذر الحفظ', errText(e)); }
    setBusy(false);
  }
  const edit = (u: any) => { setF({ id: u.id, name: u.name, email: u.email, phone: u.phone ?? '', role: u.role, branchId: u.branchId ?? '', baseSalary: u.baseSalary ?? '', biometricId: u.biometricId ?? '', tracksAttendance: u.tracksAttendance, active: u.active }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const act = async (title: string, body: string, fn: () => Promise<unknown>, ok: string, danger = true) => { if (!(await confirm({ title, body, confirmText: 'تأكيد', danger }))) return; try { await fn(); toast.success(ok); load(); } catch (e) { toast.error('تعذر التنفيذ', errText(e)); } };

  return (<>
    <PageHeader title="الموظفون" sub="المصوّرون والإداريون وبقية الفريق." right={!open && <button className="btn primary" onClick={() => { setF(blank); setOpen(true); }}>+ موظف جديد</button>} />
    {open && (<div className="card"><h2>{f.id ? 'تعديل موظف' : 'موظف جديد'}</h2>
      {!f.id && <div className="alert" style={{ margin: '12px 0' }}><span>ⓘ</span><span>لا تحدد كلمة مرور. تُنشأ بكلمة مبدئية <b className="num">12345678</b>، وعند أول دخول يؤكّد الموظف بريده برمز OTP ثم يختار كلمة مرور خاصة به.</span></div>}
      <div className="grid" style={{ marginTop: 12 }}>
        <Field label="الاسم"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="البريد الإلكتروني" help={f.id ? 'لا يمكن تغيير البريد' : 'يصله عليه رمز التحقق'}><input type="email" dir="ltr" value={f.email} onChange={set('email')} disabled={!!f.id} /></Field>
        <Field label="رقم الجوال" help="للتنبيهات والتذكيرات"><input dir="ltr" value={f.phone} onChange={set('phone')} placeholder="+9665XXXXXXXX" /></Field>
        <Field label="الدور"><select value={f.role} onChange={set('role')}>{roles.map((r) => <option key={r} value={r}>{ROLE_AR[r]}</option>)}</select></Field>
        <Field label="الفرع"><select value={f.branchId} onChange={set('branchId')}><option value="">— بدون —</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="الراتب الأساسي (ريال)"><input type="number" min={0} value={f.baseSalary} onChange={set('baseSalary')} /></Field>
        <Field label="رقم البصمة على الجهاز" help="اختياري، لربط جهاز البصمة"><input dir="ltr" value={f.biometricId} onChange={set('biometricId')} /></Field></div>
      <div className="row" style={{ marginTop: 14, gap: 28 }}><Switch checked={f.tracksAttendance} onChange={(v) => setF({ ...f, tracksAttendance: v })} label="يُحتسب حضوره ورواتبه" />{f.id && <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="الحساب مفعّل" />}</div>
      <div className="row" style={{ marginTop: 18 }}><button className="btn primary" disabled={busy || !f.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)} onClick={save}>{f.id ? 'حفظ التعديل' : 'إضافة الموظف'}</button><button className="btn" onClick={() => { setOpen(false); setF(blank); }}>إلغاء</button></div></div>)}

    <div className="card scroll">{!rows.length ? <div className="empty">لا يوجد موظفون بعد.</div> : (
      <table><thead><tr><th>الموظف</th><th>الدور</th><th>الفرع</th><th>الراتب</th><th>الحالة</th><th /></tr></thead><tbody>{rows.map((u) => (
        <tr key={u.id}><td><b>{u.name}</b><div className="muted small" dir="ltr" style={{ textAlign: 'start' }}>{u.email}</div></td><td>{ROLE_AR[u.role] ?? u.role}</td>
          <td>{branches.find((b) => b.id === u.branchId)?.name ?? <span className="muted">—</span>}</td><td className="num">{u.baseSalary !== undefined ? Number(u.baseSalary).toFixed(2) : '—'}</td>
          <td><div className="row" style={{ gap: 6 }}>{!u.active && <span className="badge">موقوف</span>}{u.mustChangePassword && <span className="badge" style={{ background: '#fdebe4' }}>لم يفعّل حسابه</span>}{!u.tracksAttendance && <span className="badge">خارج الحضور</span>}{u.active && !u.mustChangePassword && u.tracksAttendance && <span className="badge" style={{ background: '#e4f5ea' }}>نشط</span>}</div></td>
          <td><div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><button className="btn sm" onClick={() => edit(u)}>تعديل</button>
            <button className="btn sm" onClick={() => act('إعادة كلمة المرور؟', `ستعود كلمة مرور ${u.name} إلى الافتراضية، وسيؤكّد بريده برمز OTP ثم يختار كلمة جديدة.`, () => api(`/employees/${u.id}/reset-password`, { method: 'POST' }), 'تمت إعادة كلمة المرور', false)}>كلمة المرور</button>
            {['EMPLOYEE', 'PHOTOGRAPHER', 'TEAM_LEAD', 'BRANCH_MANAGER'].includes(u.role) && <button className="btn sm" onClick={async () => { const reason = await ask({ title: `إعادة ضبط جهاز ${u.name}`, body: 'يُفك ارتباط الجوال الحالي ويُطلب منه تأكيد جهاز جديد.', label: 'سبب إعادة الضبط', minLength: 3 }); if (reason) { try { await api(`/employees/${u.id}/reset-device`, { method: 'POST', body: { reason } }); toast.success('تمت إعادة ضبط الجهاز'); } catch (e) { toast.error('تعذر التنفيذ', errText(e)); } } }}>الجهاز</button>}</div></td></tr>))}</tbody></table>)}</div>
  </>);
}
