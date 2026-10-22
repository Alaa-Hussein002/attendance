'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import { useDialog, useMeta, useToast } from '../../components/Providers';
import { Field, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { fmtDay, fmtTime12, MONTH_KEYS } from '../../lib/format';

const MapPicker = dynamic(() => import('../../components/MapPicker'), { ssr: false, loading: () => <div className="map" /> });
const blank = { id: '', title: '', details: '', address: '', date: '', startTime: '14:00', endTime: '17:00', radius: 150, loc: null as null | { lat: number; lng: number }, assigneeIds: [] as string[] };
const ST: Record<string, { key: string; bg: string }> = {
  SCHEDULED: { key: 'w.tasks.status.SCHEDULED', bg: '#e4eefc' },
  CANCELLED: { key: 'w.tasks.status.CANCELLED', bg: '#ececec' },
  DONE: { key: 'w.tasks.status.DONE', bg: '#e4f5ea' },
};
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export default function Tasks() {
  const { t, locale, dir } = useI18n();
  const toast = useToast(); const { confirm, notice } = useDialog(); const { meta } = useMeta();
  const [ym, setYm] = useState<{ y: number; m: number } | null>(null);
  const [rows, setRows] = useState<any[]>([]); const [emps, setEmps] = useState<any[]>([]); const [who, setWho] = useState(''); const [loading, setLoading] = useState(false);
  const [f, setF] = useState(blank); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [q, setQ] = useState('');

  useEffect(() => { if (meta && !ym) setYm({ y: Number(meta.today.slice(0, 4)), m: Number(meta.today.slice(5, 7)) }); }, [meta, ym]);
  const load = useCallback(async () => {
    if (!ym) return; setLoading(true);
    const mm = String(ym.m).padStart(2, '0');
    try { setRows(await api(`/tasks?from=${ym.y}-${mm}-01&to=${ym.y}-${mm}-${lastDay(ym.y, ym.m)}${who ? `&userId=${who}` : ''}`)); } catch (e) { toast.error(t('w.tasks.loadError'), errText(e, t)); }
    setLoading(false);
  }, [ym, who, toast, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api<any[]>('/employees').then((e) => setEmps(e.filter((u) => u.active && u.tracksAttendance))).catch(() => {}); }, []);

  const shift = (d: number) => setYm((c) => { if (!c) return c; const n = c.y * 12 + (c.m - 1) + d; return { y: Math.floor(n / 12), m: (n % 12) + 1 }; });
  const days = useMemo(() => { const g = new Map<string, any[]>(); for (const task of rows) { (g.get(task.date) ?? g.set(task.date, []).get(task.date)!).push(task); } return [...g.entries()].sort(); }, [rows]);
  const nameOf = (id: string) => emps.find((e) => e.id === id)?.name ?? '—';
  const pickList = emps.filter((e) => !q.trim() || e.name.includes(q.trim()));

  const start = (task?: any) => { setF(task ? { id: task.id, title: task.title, details: task.details ?? '', address: task.address ?? '', date: task.date, startTime: task.startTime, endTime: task.endTime, radius: task.radiusMeters, loc: { lat: task.latitude, lng: task.longitude }, assigneeIds: task.assignees.map((a: any) => a.userId) } : { ...blank, date: meta?.today ?? '' }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const valid = f.title.trim() && f.date && f.startTime && f.endTime > f.startTime && f.loc && f.assigneeIds.length > 0;

  async function save() {
    setBusy(true);
    try {
      const body = { title: f.title, details: f.details, address: f.address, date: f.date, startTime: f.startTime, endTime: f.endTime, latitude: f.loc!.lat, longitude: f.loc!.lng, radiusMeters: f.radius, assigneeIds: f.assigneeIds };
      const r = await api(f.id ? `/tasks/${f.id}` : '/tasks', { method: f.id ? 'PUT' : 'POST', body });
      toast.success(f.id ? t('w.tasks.updated') : t('w.tasks.created'), t('w.tasks.notified')); setOpen(false); setF(blank); load();
      if (r.conflicts?.length) notice({ tone: 'warn', title: t('w.tasks.conflictTitle'), body: <>{t('w.tasks.conflictBody', { list: r.conflicts.map((c: any) => c.name).join(t('w.common.listSep')) })}<ul style={{ margin: '8px 0 0', paddingInlineStart: 18 }}>{r.conflicts.map((c: any) => <li key={c.userId + c.taskId}>{c.name} — {c.title}</li>)}</ul></> });
    } catch (e) { toast.error(t('w.tasks.saveError'), errText(e, t)); }
    setBusy(false);
  }
  async function cancel(task: any) {
    if (!(await confirm({ title: t('w.tasks.cancelTitle'), body: t('w.tasks.cancelBody', { title: task.title }), confirmText: t('w.tasks.cancelConfirm'), danger: true }))) return;
    try { await api(`/tasks/${task.id}/cancel`, { method: 'POST' }); toast.success(t('w.tasks.cancelled')); load(); } catch (e) { toast.error(t('w.tasks.cancelError'), errText(e, t)); }
  }
  const status = (task: any) => (task.status === 'SCHEDULED' && meta && new Date(task.endsAt) < new Date(meta.serverTime) ? ST.DONE : ST[task.status]);

  return (<>
    <PageHeader title={t('w.tasks.title')} sub={t('w.tasks.sub')} right={!open && <button className="btn primary" onClick={() => start()}>+ {t('w.tasks.new')}</button>} />
    {open && (<div className="card"><h2>{f.id ? t('w.tasks.editTitle') : t('w.tasks.newTitle')}</h2>
      <div className="stack" style={{ marginTop: 14 }}>
        <Field label={t('w.tasks.titleField')}><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t('w.tasks.titlePh')} /></Field>
        <div className="grid"><Field label={t('w.tasks.date')}><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label={t('w.tasks.from')} help={f.startTime && fmtTime12(f.startTime, locale)}><input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></Field>
          <Field label={t('w.tasks.to')} error={f.endTime <= f.startTime ? t('w.tasks.endAfterStart') : undefined}><input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></Field></div>
        <Field label={t('w.tasks.details')} help={t('w.tasks.detailsHelp')}><textarea rows={4} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} placeholder={t('w.tasks.detailsPh')} /></Field>
        <div><div className="lbl">{t('w.tasks.assignees', { n: f.assigneeIds.length })}</div>
          <div className="row" style={{ marginBottom: 8 }}>{f.assigneeIds.map((id) => <button key={id} type="button" className="pill on" onClick={() => setF({ ...f, assigneeIds: f.assigneeIds.filter((x) => x !== id) })}>{nameOf(id)} ✕</button>)}</div>
          <input placeholder={t('w.tasks.searchEmployee')} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          <div className="row" style={{ maxHeight: 130, overflow: 'auto' }}>{pickList.filter((e) => !f.assigneeIds.includes(e.id)).map((e) => <button key={e.id} type="button" className="pill" onClick={() => setF({ ...f, assigneeIds: [...f.assigneeIds, e.id] })}>+ {e.name}</button>)}</div></div>
        <div><div className="lbl">{t('w.tasks.location')}</div><MapPicker value={f.loc} radius={f.radius} onChange={(loc) => setF((s) => ({ ...s, loc }))} onPlace={(a) => setF((s) => ({ ...s, address: s.address || a }))} />
          <div className="grid" style={{ marginTop: 14 }}><Field label={t('w.tasks.address')}><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            <Field label={t('w.tasks.radius', { m: f.radius })}><input type="range" min={30} max={1000} step={10} value={f.radius} onChange={(e) => setF({ ...f, radius: Number(e.target.value) })} style={{ padding: 0 }} /></Field></div></div>
        <div className="alert"><span>ⓘ</span><span>{t('w.tasks.note')}</span></div>
        <div className="row"><button className="btn primary" disabled={busy || !valid} onClick={save}>{busy ? <Spinner /> : f.id ? t('w.tasks.save') : t('w.tasks.book')}</button><button className="btn" onClick={() => { setOpen(false); setF(blank); }}>{t('w.tasks.cancel')}</button></div>
      </div></div>)}

    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}>
      <div className="row"><button className="btn sm" onClick={() => shift(-1)} aria-label={t('w.tasks.monthPrev')}>{dir === 'rtl' ? '›' : '‹'}</button><b style={{ minWidth: 150, textAlign: 'center' }}>{ym ? `${t(MONTH_KEYS[ym.m - 1])} ${ym.y}` : ''}</b><button className="btn sm" onClick={() => shift(1)} aria-label={t('w.tasks.monthNext')}>{dir === 'rtl' ? '‹' : '›'}</button>
        <button className="btn sm ghost" onClick={() => meta && setYm({ y: Number(meta.today.slice(0, 4)), m: Number(meta.today.slice(5, 7)) })}>{t('w.tasks.thisMonth')}</button>{loading && <Spinner />}</div>
      <select style={{ width: 220 }} value={who} onChange={(e) => setWho(e.target.value)}><option value="">{t('w.tasks.allEmployees')}</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div></div>

    {!days.length && !loading && <div className="card empty">{t('w.tasks.empty')}</div>}
    {days.map(([date, list]) => (<div key={date} className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', background: meta?.today === date ? 'var(--black)' : 'var(--soft)', color: meta?.today === date ? 'var(--paper)' : 'inherit', fontWeight: 700 }}>{fmtDay(date, t)}{meta?.today === date ? ` · ${t('w.tasks.today')}` : ''}</div>
      <table><tbody>{list.map((task) => { const st = status(task); return (
        <tr key={task.id} style={{ opacity: task.status === 'CANCELLED' ? .55 : 1 }}><td style={{ width: 150 }} className="num"><b>{fmtTime12(task.startTime, locale)}</b><div className="muted small">{t('w.tasks.toTime', { time: fmtTime12(task.endTime, locale) })}</div></td>
          <td><b>{task.title}</b>{task.address && <div className="muted small">📍 {task.address}</div>}<div className="row" style={{ gap: 6, marginTop: 6 }}>{task.assignees.map((a: any) => <span key={a.userId} className="badge">{a.name}</span>)}</div></td>
          <td style={{ width: 110 }}><span className="badge" style={{ background: st.bg }}>{t(st.key)}</span></td>
          <td style={{ width: 150, textAlign: 'end' }}>{task.status === 'SCHEDULED' && <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><button className="btn sm" onClick={() => start(task)}>{t('common.edit')}</button><button className="btn sm danger" onClick={() => cancel(task)}>{t('w.tasks.cancel')}</button></div>}</td></tr>); })}</tbody></table></div>))}
  </>);
}
