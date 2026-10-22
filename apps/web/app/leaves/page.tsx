'use client';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import { useDialog, useToast } from '../../components/Providers';
import { Field, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { fmtDay } from '../../lib/format';

const ST: Record<string, { key: string; bg: string }> = {
  PENDING: { key: 'w.leaves.status.PENDING', bg: '#fdebe4' },
  APPROVED: { key: 'w.leaves.status.APPROVED', bg: '#e4f5ea' },
  REJECTED: { key: 'w.leaves.status.REJECTED', bg: '#eee' },
};
const Badge = ({ s }: { s: string }) => { const { t } = useI18n(); const st = ST[s] ?? { key: s, bg: '#eee' }; return <span className="badge" style={{ background: st.bg }}>{t(st.key)}</span>; };

export default function Leaves() {
  const { t } = useI18n();
  const toast = useToast(); const { ask, confirm } = useDialog();
  const [leaves, setLeaves] = useState<any[]>([]); const [exc, setExc] = useState<any[]>([]); const [emps, setEmps] = useState<any[]>([]); const [all, setAll] = useState(false);
  const [ex, setEx] = useState({ userId: '', date: '', reason: '' }); const [man, setMan] = useState({ userId: '', date: '', time: '', reason: '' });
  const load = useCallback(() => Promise.all([api<any[]>('/leaves'), api<any[]>('/excuse-requests'), api<any[]>('/employees')]).then(([l, x, e]) => { setLeaves(l); setExc(x); setEmps(e.filter((u) => u.tracksAttendance && u.active)); }).catch((e) => toast.error(t('w.leaves.loadError'), errText(e, t))), [toast, t]);
  useEffect(() => { load(); }, [load]);
  const name = (id: string) => emps.find((e) => e.id === id)?.name ?? '—';
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); load(); return true; } catch (e) { toast.error(t('w.leaves.actionError'), errText(e, t)); return false; } };
  const show = (rows: any[]) => (all ? rows : rows.filter((r) => r.status === 'PENDING'));
  const pick = (v: string, set: (s: string) => void) => <select value={v} onChange={(e) => set(e.target.value)}><option value="">{t('w.leaves.pickEmployee')}</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>;
  const pendingL = leaves.filter((l) => l.status === 'PENDING').length; const pendingX = exc.filter((l) => l.status === 'PENDING').length;

  return (<>
    <PageHeader title={t('w.leaves.title')} sub={t('w.leaves.sub')}
      right={<div className="seg"><button className={!all ? 'on' : ''} onClick={() => setAll(false)}>{t('w.leaves.pending')}</button><button className={all ? 'on' : ''} onClick={() => setAll(true)}>{t('w.leaves.all')}</button></div>} />
    <div className="card scroll"><h2>{t('w.leaves.requests')} {pendingL > 0 && <span className="badge" style={{ background: '#fdebe4' }}>{pendingL}</span>}</h2>
      {!show(leaves).length ? <div className="empty">{t(all ? 'w.leaves.emptyAll' : 'w.leaves.emptyPending')}</div> : (<table><thead><tr><th>{t('w.leaves.employee')}</th><th>{t('w.leaves.from')}</th><th>{t('w.leaves.to')}</th><th>{t('w.leaves.reason')}</th><th>{t('w.leaves.status')}</th><th /></tr></thead><tbody>{show(leaves).map((l) => (
        <tr key={l.id}><td><b>{name(l.userId)}</b></td><td className="num">{fmtDay(l.fromDate, t)}</td><td className="num">{fmtDay(l.toDate, t)}</td><td className="muted">{l.reason ?? '—'}</td><td><Badge s={l.status} /></td>
          <td>{l.status === 'PENDING' && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm primary" onClick={() => run(() => api(`/leaves/${l.id}/decision`, { method: 'POST', body: { approve: true } }), t('w.leaves.approved'))}>{t('w.leaves.approve')}</button>
            <button className="btn sm" onClick={() => run(() => api(`/leaves/${l.id}/decision`, { method: 'POST', body: { approve: false } }), t('w.leaves.rejected'))}>{t('w.leaves.reject')}</button></div>}</td></tr>))}</tbody></table>)}</div>

    <div className="card scroll"><h2>{t('w.leaves.excuses')} {pendingX > 0 && <span className="badge" style={{ background: '#fdebe4' }}>{pendingX}</span>}</h2><p className="sub">{t('w.leaves.excusesSub')}</p>
      {!show(exc).length ? <div className="empty">{t(all ? 'w.leaves.emptyAll' : 'w.leaves.emptyPending')}</div> : (<table><thead><tr><th>{t('w.leaves.employee')}</th><th>{t('w.leaves.day')}</th><th>{t('w.leaves.excuse')}</th><th>{t('w.leaves.status')}</th><th /></tr></thead><tbody>{show(exc).map((l) => (
        <tr key={l.id}><td><b>{name(l.userId)}</b></td><td className="num">{fmtDay(l.localDate, t)}</td><td>{l.reason}</td><td><Badge s={l.status} /></td>
          <td>{l.status === 'PENDING' && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm primary" onClick={async () => { if (await confirm({ title: t('w.leaves.acceptTitle'), body: t('w.leaves.acceptBody', { name: name(l.userId), date: fmtDay(l.localDate, t) }), confirmText: t('w.leaves.accept') })) run(() => api(`/excuse-requests/${l.id}/decision`, { method: 'POST', body: { approve: true } }), t('w.leaves.accepted')); }}>{t('w.leaves.accept')}</button>
            <button className="btn sm" onClick={async () => { const note = await ask({ title: t('w.leaves.rejectTitle'), label: t('w.leaves.rejectLabel'), minLength: 0, confirmText: t('w.leaves.reject') }); if (note !== null) run(() => api(`/excuse-requests/${l.id}/decision`, { method: 'POST', body: { approve: false, note } }), t('w.leaves.excuseRejected')); }}>{t('w.leaves.reject')}</button></div>}</td></tr>))}</tbody></table>)}</div>

    <div className="card"><h2>{t('w.leaves.excuseTitle')}</h2><p className="sub">{t('w.leaves.excuseSub')}</p>
      <div className="grid"><Field label={t('w.leaves.employee')}>{pick(ex.userId, (v) => setEx({ ...ex, userId: v }))}</Field><Field label={t('w.leaves.day')}><input type="date" value={ex.date} onChange={(e) => setEx({ ...ex, date: e.target.value })} /></Field><Field label={t('w.leaves.reason')}><input value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} /></Field></div>
      <button className="btn primary" style={{ marginTop: 14 }} disabled={!ex.userId || !ex.date || ex.reason.trim().length < 3} onClick={async () => { if (await run(() => api('/attendance/excuse', { method: 'POST', body: ex }), t('w.leaves.excuseDone'))) setEx({ userId: '', date: '', reason: '' }); }}>{t('w.leaves.excuseAction')}</button></div>

    <div className="card"><h2>{t('w.leaves.manualTitle')}</h2><p className="sub">{t('w.leaves.manualSub')}</p>
      <div className="grid"><Field label={t('w.leaves.employee')}>{pick(man.userId, (v) => setMan({ ...man, userId: v }))}</Field><Field label={t('w.leaves.day')}><input type="date" value={man.date} onChange={(e) => setMan({ ...man, date: e.target.value })} /></Field>
        <Field label={t('w.leaves.checkInTime')}><input type="time" value={man.time} onChange={(e) => setMan({ ...man, time: e.target.value })} /></Field><Field label={t('w.leaves.reason')}><input value={man.reason} onChange={(e) => setMan({ ...man, reason: e.target.value })} /></Field></div>
      <button className="btn primary" style={{ marginTop: 14 }} disabled={!man.userId || !man.date || !man.time || man.reason.trim().length < 3} onClick={async () => { if (await run(() => api('/attendance/manual', { method: 'POST', body: man }), t('w.leaves.manualDone'))) setMan({ userId: '', date: '', time: '', reason: '' }); }}>{t('w.leaves.record')}</button></div>
  </>);
}
