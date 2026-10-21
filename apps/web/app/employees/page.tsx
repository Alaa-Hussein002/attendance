'use client';
import { useCallback, useEffect, useState } from 'react';
import { useDialog, useToast } from '../../components/Providers';
import { Field, PageHeader, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { roleLabel } from '../../lib/format';
import { session } from '../../lib/session';
import { useI18n } from '@attendance/i18n/react';

const STAFF_ROLES = ['PHOTOGRAPHER', 'EMPLOYEE', 'TEAM_LEAD', 'BRANCH_MANAGER'];
const blank = { id: '', name: '', email: '', phone: '', role: 'PHOTOGRAPHER', branchId: '', baseSalary: '', biometricId: '', startDate: '', tracksAttendance: true, active: true };

export default function Employees() {
  const toast = useToast(); const { confirm, ask } = useDialog();
  const { t } = useI18n();
  const isAdmin = session.user()?.role === 'COMPANY_ADMIN';
  const roles = isAdmin ? [...STAFF_ROLES, 'HR', 'COMPANY_ADMIN'] : STAFF_ROLES;
  const [rows, setRows] = useState<any[]>([]); const [branches, setBranches] = useState<any[]>([]); const [f, setF] = useState(blank); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const load = useCallback(() => Promise.all([api<any[]>('/employees'), api<any[]>('/branches')]).then(([e, b]) => { setRows(e); setBranches(b); }).catch((x) => toast.error(t('w.common.error'), errText(x, t))), [toast, t]);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      const body = { name: f.name, email: f.email, phone: f.phone || undefined, role: f.role, branchId: f.branchId || (f.id ? null : undefined), baseSalary: f.baseSalary === '' ? 0 : Number(f.baseSalary), biometricId: f.biometricId || (f.id ? null : undefined), startDate: f.startDate || undefined, tracksAttendance: f.tracksAttendance, ...(f.id ? { active: f.active } : {}) };
      if (f.id) { const { email: _e, ...upd } = body; await api(`/employees/${f.id}`, { method: 'PUT', body: upd }); toast.success(t('w.employees.saved')); }
      else { await api('/employees', { method: 'POST', body }); toast.success(t('w.employees.created'), t('w.employees.createdHint')); }
      setF(blank); setOpen(false); load();
    } catch (e) { toast.error(t('w.common.error'), errText(e, t)); }
    setBusy(false);
  }
  const edit = (u: any) => { setF({ id: u.id, name: u.name, email: u.email, phone: u.phone ?? '', role: u.role, branchId: u.branchId ?? '', baseSalary: u.baseSalary ?? '', biometricId: u.biometricId ?? '', startDate: u.startDate ?? '', tracksAttendance: u.tracksAttendance, active: u.active }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const act = async (title: string, body: string, fn: () => Promise<unknown>, ok: string, danger = true) => { if (!(await confirm({ title, body, confirmText: t('common.confirm'), danger }))) return; try { await fn(); toast.success(ok); load(); } catch (e) { toast.error(t('w.common.error'), errText(e, t)); } };

  return (<>
    <PageHeader title={t('w.employees.title')} sub={t('w.employees.subtitle', { count: rows.length })} right={!open && <button className="btn primary" onClick={() => { setF(blank); setOpen(true); }}>+ {t('w.employees.new')}</button>} />
    {open && (<div className="card"><h2>{f.id ? t('w.employees.edit') : t('w.employees.new')}</h2>
      {!f.id && <div className="alert" style={{ margin: '12px 0' }}><span>ℹ</span><span>{t('w.employees.defaultPasswordBody')}</span></div>}
      <div className="grid" style={{ marginTop: 12 }}>
        <Field label={t('w.employees.col.name')}><input value={f.name} onChange={set('name')} /></Field>
        <Field label={t('w.employees.col.email')} help={f.id ? t('w.employees.emailLocked') : t('w.employees.emailHint')}><input type="email" dir="ltr" value={f.email} onChange={set('email')} disabled={!!f.id} /></Field>
        <Field label={t('w.employees.col.phone')} help={t('w.employees.phoneHint')}><input dir="ltr" value={f.phone} onChange={set('phone')} placeholder="+9665XXXXXXXX" /></Field>
        <Field label={t('w.employees.col.role')}><select value={f.role} onChange={set('role')}>{roles.map((r) => <option key={r} value={r}>{roleLabel(r, t)}</option>)}</select></Field>
        <Field label={t('w.employees.col.branch')}><select value={f.branchId} onChange={set('branchId')}><option value="">{t('w.employees.noBranch')}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label={t('w.employees.col.salary')}><input type="number" min={0} value={f.baseSalary} onChange={set('baseSalary')} /></Field>
        <Field label={t('w.employees.startDate')}><input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label={t('w.employees.biometricId')} help={t('w.employees.biometricHint')}><input dir="ltr" value={f.biometricId} onChange={set('biometricId')} /></Field></div>
      <div className="row" style={{ marginTop: 14, gap: 28 }}><Switch checked={f.tracksAttendance} onChange={(v) => setF({ ...f, tracksAttendance: v })} label={t('w.employees.tracksAttendance')} />{f.id && <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label={t('w.employees.active')} />}</div>
      <div className="row" style={{ marginTop: 18 }}><button className="btn primary" disabled={busy || !f.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)} onClick={save}>{f.id ? t('w.employees.save') : t('w.employees.create')}</button><button className="btn" onClick={() => { setOpen(false); setF(blank); }}>{t('common.cancel')}</button></div></div>)}

    <div className="card scroll">{!rows.length ? <div className="empty">{t('w.employees.noResults')}</div> : (
      <table><thead><tr><th>{t('w.employees.col.name')}</th><th>{t('w.employees.col.role')}</th><th>{t('w.employees.col.branch')}</th><th>{t('w.employees.col.salary')}</th><th>{t('w.employees.col.status')}</th><th /></tr></thead><tbody>{rows.map((u) => (
        <tr key={u.id}><td><b>{u.name}</b><div className="muted small" dir="ltr" style={{ textAlign: 'start' }}>{u.email}</div></td><td>{roleLabel(u.role, t)}</td>
          <td>{branches.find((b) => b.id === u.branchId)?.name ?? <span className="muted">—</span>}</td><td className="num">{u.baseSalary !== undefined ? Number(u.baseSalary).toFixed(2) : '—'}</td>
          <td><div className="row" style={{ gap: 6 }}>{!u.active && <span className="badge">{u.endDate ? t('w.employees.ended', { date: u.endDate }) : t('w.employees.inactive')}</span>}{u.mustChangePassword && <span className="badge" style={{ background: '#fdebe4' }}>{t('w.employees.mustChange')}</span>}{!u.tracksAttendance && <span className="badge">{t('w.employees.notTracked')}</span>}{u.active && !u.mustChangePassword && u.tracksAttendance && <span className="badge" style={{ background: '#e4f5ea' }}>{t('w.employees.ok')}</span>}</div></td>
          <td><div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><button className="btn sm" onClick={() => edit(u)}>{t('w.employees.edit')}</button>
            <button className="btn sm" onClick={() => act(t('w.employees.resetPassword'), t('w.employees.resetPasswordConfirm', { name: u.name }), () => api(`/employees/${u.id}/reset-password`, { method: 'POST' }), t('w.employees.resetPasswordDone'), false)}>{t('w.employees.resetPassword')}</button>
            {['EMPLOYEE', 'PHOTOGRAPHER', 'TEAM_LEAD', 'BRANCH_MANAGER'].includes(u.role) && <button className="btn sm" onClick={async () => { const reason = await ask({ title: t('w.employees.resetDeviceTitle', { name: u.name }), body: t('w.employees.resetDeviceBody'), label: t('w.employees.resetDeviceReason'), minLength: 3 }); if (reason) { try { await api(`/employees/${u.id}/reset-device`, { method: 'POST', body: { reason } }); toast.success(t('w.employees.resetDeviceDone')); } catch (e) { toast.error(t('w.common.error'), errText(e, t)); } } }}>{t('w.employees.resetDevice')}</button>}</div></td></tr>))}</tbody></table>)}</div>
  </>);
}
