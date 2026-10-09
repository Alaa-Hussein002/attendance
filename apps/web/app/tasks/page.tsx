'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDialog, useMeta, useToast } from '../../components/Providers';
import { Field, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { fmtDay, fmtTime12, MONTHS_AR } from '../../lib/format';

const MapPicker = dynamic(() => import('../../components/MapPicker'), { ssr: false, loading: () => <div className="map" /> });
const blank = { id: '', title: '', details: '', address: '', date: '', startTime: '14:00', endTime: '17:00', radius: 150, loc: null as null | { lat: number; lng: number }, assigneeIds: [] as string[] };
const ST: Record<string, [string, string]> = { SCHEDULED: ['مجدولة', '#e4eefc'], CANCELLED: ['ملغاة', '#ececec'], DONE: ['منتهية', '#e4f5ea'] };
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export default function Tasks() {
  const toast = useToast(); const { confirm, notice } = useDialog(); const { meta } = useMeta();
  const [ym, setYm] = useState<{ y: number; m: number } | null>(null);
  const [rows, setRows] = useState<any[]>([]); const [emps, setEmps] = useState<any[]>([]); const [who, setWho] = useState(''); const [loading, setLoading] = useState(false);
  const [f, setF] = useState(blank); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [q, setQ] = useState('');

  useEffect(() => { if (meta && !ym) setYm({ y: Number(meta.today.slice(0, 4)), m: Number(meta.today.slice(5, 7)) }); }, [meta, ym]);
  const load = useCallback(async () => {
    if (!ym) return; setLoading(true);
    const mm = String(ym.m).padStart(2, '0');
    try { setRows(await api(`/tasks?from=${ym.y}-${mm}-01&to=${ym.y}-${mm}-${lastDay(ym.y, ym.m)}${who ? `&userId=${who}` : ''}`)); } catch (e) { toast.error('تعذر تحميل المهام', errText(e)); }
    setLoading(false);
  }, [ym, who, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api<any[]>('/employees').then((e) => setEmps(e.filter((u) => u.active && u.tracksAttendance))).catch(() => {}); }, []);

  const shift = (d: number) => setYm((c) => { if (!c) return c; const t = c.y * 12 + (c.m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; });
  const days = useMemo(() => { const g = new Map<string, any[]>(); for (const t of rows) { (g.get(t.date) ?? g.set(t.date, []).get(t.date)!).push(t); } return [...g.entries()].sort(); }, [rows]);
  const nameOf = (id: string) => emps.find((e) => e.id === id)?.name ?? '—';
  const pickList = emps.filter((e) => !q.trim() || e.name.includes(q.trim()));

  const start = (t?: any) => { setF(t ? { id: t.id, title: t.title, details: t.details ?? '', address: t.address ?? '', date: t.date, startTime: t.startTime, endTime: t.endTime, radius: t.radiusMeters, loc: { lat: t.latitude, lng: t.longitude }, assigneeIds: t.assignees.map((a: any) => a.userId) } : { ...blank, date: meta?.today ?? '' }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const valid = f.title.trim() && f.date && f.startTime && f.endTime > f.startTime && f.loc && f.assigneeIds.length > 0;

  async function save() {
    setBusy(true);
    try {
      const body = { title: f.title, details: f.details, address: f.address, date: f.date, startTime: f.startTime, endTime: f.endTime, latitude: f.loc!.lat, longitude: f.loc!.lng, radiusMeters: f.radius, assigneeIds: f.assigneeIds };
      const r = await api(f.id ? `/tasks/${f.id}` : '/tasks', { method: f.id ? 'PUT' : 'POST', body });
      toast.success(f.id ? 'تم تحديث المهمة' : 'تم حجز المهمة', 'أُرسل إشعار للمكلّفين'); setOpen(false); setF(blank); load();
      if (r.conflicts?.length) notice({ tone: 'warn', title: 'تنبيه: مهمة متداخلة', body: <>حُفظت المهمة، لكن لدى {r.conflicts.map((c: any) => <b key={c.userId + c.taskId}> {c.name} </b>)} مهمة أخرى في نفس الوقت:<ul style={{ margin: '8px 0 0', paddingInlineStart: 18 }}>{r.conflicts.map((c: any) => <li key={c.userId + c.taskId}>{c.name} — {c.title}</li>)}</ul></> });
    } catch (e) { toast.error('تعذر الحفظ', errText(e)); }
    setBusy(false);
  }
  async function cancel(t: any) {
    if (!(await confirm({ title: 'إلغاء المهمة؟', body: `سيُبلَّغ المكلّفون بالإلغاء: ${t.title}`, confirmText: 'إلغاء المهمة', danger: true }))) return;
    try { await api(`/tasks/${t.id}/cancel`, { method: 'POST' }); toast.success('تم إلغاء المهمة'); load(); } catch (e) { toast.error('تعذر الإلغاء', errText(e)); }
  }
  const status = (t: any): [string, string] => (t.status === 'SCHEDULED' && meta && new Date(t.endsAt) < new Date(meta.serverTime) ? ST.DONE : ST[t.status]);

  return (<>
    <PageHeader title="المهام والحجوزات" sub="كلّف مصوّراً بمهمة في موقع محدد. يصله إشعار فوراً، وتذكير صباحي، وتذكير قبل الموعد بساعة." right={!open && <button className="btn primary" onClick={() => start()}>+ مهمة جديدة</button>} />
    {open && (<div className="card"><h2>{f.id ? 'تعديل مهمة' : 'مهمة جديدة'}</h2>
      <div className="stack" style={{ marginTop: 14 }}>
        <Field label="عنوان المهمة"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: افتتاح فرع — 3 ريلز وفيديو طويل" /></Field>
        <div className="grid"><Field label="اليوم"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="من" help={f.startTime && fmtTime12(f.startTime)}><input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></Field>
          <Field label="إلى" error={f.endTime <= f.startTime ? 'يجب أن يكون بعد وقت البداية' : undefined}><input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></Field></div>
        <Field label="التفاصيل المطلوبة" help="ما المطلوب تصويره، العدد، المخرجات…"><textarea rows={4} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></Field>
        <div><div className="lbl">المكلّفون ({f.assigneeIds.length})</div>
          <div className="row" style={{ marginBottom: 8 }}>{f.assigneeIds.map((id) => <button key={id} type="button" className="pill on" onClick={() => setF({ ...f, assigneeIds: f.assigneeIds.filter((x) => x !== id) })}>{nameOf(id)} ✕</button>)}</div>
          <input placeholder="ابحث عن موظف لإضافته…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          <div className="row" style={{ maxHeight: 130, overflow: 'auto' }}>{pickList.filter((e) => !f.assigneeIds.includes(e.id)).map((e) => <button key={e.id} type="button" className="pill" onClick={() => setF({ ...f, assigneeIds: [...f.assigneeIds, e.id] })}>+ {e.name}</button>)}</div></div>
        <div><div className="lbl">موقع المهمة</div><MapPicker value={f.loc} radius={f.radius} onChange={(loc) => setF((s) => ({ ...s, loc }))} onPlace={(a) => setF((s) => ({ ...s, address: s.address || a }))} />
          <div className="grid" style={{ marginTop: 14 }}><Field label="العنوان (يظهر للموظف)"><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            <Field label={`نطاق الحضور حول الموقع: ${f.radius} متراً`}><input type="range" min={30} max={1000} step={10} value={f.radius} onChange={(e) => setF({ ...f, radius: Number(e.target.value) })} style={{ padding: 0 }} /></Field></div></div>
        <div className="alert"><span>ⓘ</span><span>عند وصول المصوّر لموقع المهمة يسجّل حضوره من التطبيق (من قبل البدء بساعة)، ويُحتسب التأخير من وقت بداية المهمة.</span></div>
        <div className="row"><button className="btn primary" disabled={busy || !valid} onClick={save}>{busy ? <Spinner /> : f.id ? 'حفظ التعديل' : 'حجز المهمة وإبلاغ المكلّفين'}</button><button className="btn" onClick={() => { setOpen(false); setF(blank); }}>إلغاء</button></div>
      </div></div>)}

    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}>
      <div className="row"><button className="btn sm" onClick={() => shift(-1)} aria-label="الشهر السابق">›</button><b style={{ minWidth: 150, textAlign: 'center' }}>{ym ? `${MONTHS_AR[ym.m - 1]} ${ym.y}` : ''}</b><button className="btn sm" onClick={() => shift(1)} aria-label="الشهر التالي">‹</button>
        <button className="btn sm ghost" onClick={() => meta && setYm({ y: Number(meta.today.slice(0, 4)), m: Number(meta.today.slice(5, 7)) })}>هذا الشهر</button>{loading && <Spinner />}</div>
      <select style={{ width: 220 }} value={who} onChange={(e) => setWho(e.target.value)}><option value="">كل الموظفين</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div></div>

    {!days.length && !loading && <div className="card empty">لا توجد مهام في هذا الشهر.</div>}
    {days.map(([date, list]) => (<div key={date} className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', background: meta?.today === date ? 'var(--black)' : 'var(--soft)', color: meta?.today === date ? 'var(--paper)' : 'inherit', fontWeight: 700 }}>{fmtDay(date)}{meta?.today === date ? ' · اليوم' : ''}</div>
      <table><tbody>{list.map((t) => { const [lab, bg] = status(t); return (
        <tr key={t.id} style={{ opacity: t.status === 'CANCELLED' ? .55 : 1 }}><td style={{ width: 150 }} className="num"><b>{fmtTime12(t.startTime)}</b><div className="muted small">إلى {fmtTime12(t.endTime)}</div></td>
          <td><b>{t.title}</b>{t.address && <div className="muted small">📍 {t.address}</div>}<div className="row" style={{ gap: 6, marginTop: 6 }}>{t.assignees.map((a: any) => <span key={a.userId} className="badge">{a.name}</span>)}</div></td>
          <td style={{ width: 110 }}><span className="badge" style={{ background: bg }}>{lab}</span></td>
          <td style={{ width: 150, textAlign: 'end' }}>{t.status === 'SCHEDULED' && <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><button className="btn sm" onClick={() => start(t)}>تعديل</button><button className="btn sm danger" onClick={() => cancel(t)}>إلغاء</button></div>}</td></tr>); })}</tbody></table></div>))}
  </>);
}
