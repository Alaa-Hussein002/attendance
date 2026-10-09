'use client';
import { useCallback, useEffect, useState } from 'react';
import { useDialog, useToast } from '../../components/Providers';
import { Field, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { fmtDay } from '../../lib/format';

const ST: Record<string, [string, string]> = { PENDING: ['بانتظار القرار', '#fdebe4'], APPROVED: ['موافق عليه', '#e4f5ea'], REJECTED: ['مرفوض', '#eee'] };
const Badge = ({ s }: { s: string }) => <span className="badge" style={{ background: ST[s][1] }}>{ST[s][0]}</span>;

export default function Leaves() {
  const toast = useToast(); const { ask, confirm } = useDialog();
  const [leaves, setLeaves] = useState<any[]>([]); const [exc, setExc] = useState<any[]>([]); const [emps, setEmps] = useState<any[]>([]); const [all, setAll] = useState(false);
  const [ex, setEx] = useState({ userId: '', date: '', reason: '' }); const [man, setMan] = useState({ userId: '', date: '', time: '', reason: '' });
  const load = useCallback(() => Promise.all([api<any[]>('/leaves'), api<any[]>('/excuse-requests'), api<any[]>('/employees')]).then(([l, x, e]) => { setLeaves(l); setExc(x); setEmps(e.filter((u) => u.tracksAttendance && u.active)); }).catch((e) => toast.error('تعذر التحميل', errText(e))), [toast]);
  useEffect(() => { load(); }, [load]);
  const name = (id: string) => emps.find((e) => e.id === id)?.name ?? '—';
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); load(); return true; } catch (e) { toast.error('تعذر التنفيذ', errText(e)); return false; } };
  const show = (rows: any[]) => (all ? rows : rows.filter((r) => r.status === 'PENDING'));
  const pick = (v: string, set: (s: string) => void) => <select value={v} onChange={(e) => set(e.target.value)}><option value="">— اختر الموظف —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>;
  const pendingL = leaves.filter((l) => l.status === 'PENDING').length; const pendingX = exc.filter((l) => l.status === 'PENDING').length;

  return (<>
    <PageHeader title="الإجازات والأعذار" sub="الطلبات المقدّمة من الموظفين، والإجراءات اليدوية للموارد البشرية."
      right={<div className="seg"><button className={!all ? 'on' : ''} onClick={() => setAll(false)}>بانتظار القرار</button><button className={all ? 'on' : ''} onClick={() => setAll(true)}>الكل</button></div>} />
    <div className="card scroll"><h2>طلبات الإجازة {pendingL > 0 && <span className="badge" style={{ background: '#fdebe4' }}>{pendingL}</span>}</h2>
      {!show(leaves).length ? <div className="empty">لا توجد طلبات {all ? '' : 'بانتظار القرار'}.</div> : (<table><thead><tr><th>الموظف</th><th>من</th><th>إلى</th><th>السبب</th><th>الحالة</th><th /></tr></thead><tbody>{show(leaves).map((l) => (
        <tr key={l.id}><td><b>{name(l.userId)}</b></td><td className="num">{fmtDay(l.fromDate)}</td><td className="num">{fmtDay(l.toDate)}</td><td className="muted">{l.reason ?? '—'}</td><td><Badge s={l.status} /></td>
          <td>{l.status === 'PENDING' && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm primary" onClick={() => run(() => api(`/leaves/${l.id}/decision`, { method: 'POST', body: { approve: true } }), 'تمت الموافقة على الإجازة')}>موافقة</button>
            <button className="btn sm" onClick={() => run(() => api(`/leaves/${l.id}/decision`, { method: 'POST', body: { approve: false } }), 'تم رفض الطلب')}>رفض</button></div>}</td></tr>))}</tbody></table>)}</div>

    <div className="card scroll"><h2>طلبات الأعذار {pendingX > 0 && <span className="badge" style={{ background: '#fdebe4' }}>{pendingX}</span>}</h2><p className="sub">عذر عن يوم تأخر أو غياب فيه. الموافقة تحوّل اليوم إلى يوم محايد بلا خصم.</p>
      {!show(exc).length ? <div className="empty">لا توجد طلبات {all ? '' : 'بانتظار القرار'}.</div> : (<table><thead><tr><th>الموظف</th><th>اليوم</th><th>العذر</th><th>الحالة</th><th /></tr></thead><tbody>{show(exc).map((l) => (
        <tr key={l.id}><td><b>{name(l.userId)}</b></td><td className="num">{fmtDay(l.localDate)}</td><td>{l.reason}</td><td><Badge s={l.status} /></td>
          <td>{l.status === 'PENDING' && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm primary" onClick={async () => { if (await confirm({ title: 'قبول العذر؟', body: `سيُعفى ${name(l.userId)} من يوم ${fmtDay(l.localDate)} دون خصم.`, confirmText: 'قبول' })) run(() => api(`/excuse-requests/${l.id}/decision`, { method: 'POST', body: { approve: true } }), 'تم قبول العذر'); }}>قبول</button>
            <button className="btn sm" onClick={async () => { const note = await ask({ title: 'رفض العذر', label: 'سبب الرفض (يظهر للموظف)', minLength: 0, confirmText: 'رفض' }); if (note !== null) run(() => api(`/excuse-requests/${l.id}/decision`, { method: 'POST', body: { approve: false, note } }), 'تم رفض العذر'); }}>رفض</button></div>}</td></tr>))}</tbody></table>)}</div>

    <div className="card"><h2>إعفاء يوم مباشرة</h2><p className="sub">بدون طلب من الموظف. السبب إلزامي ويُسجَّل.</p>
      <div className="grid"><Field label="الموظف">{pick(ex.userId, (v) => setEx({ ...ex, userId: v }))}</Field><Field label="اليوم"><input type="date" value={ex.date} onChange={(e) => setEx({ ...ex, date: e.target.value })} /></Field><Field label="السبب"><input value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} /></Field></div>
      <button className="btn primary" style={{ marginTop: 14 }} disabled={!ex.userId || !ex.date || ex.reason.trim().length < 3} onClick={async () => { if (await run(() => api('/attendance/excuse', { method: 'POST', body: ex }), 'تم إعفاء اليوم')) setEx({ userId: '', date: '', reason: '' }); }}>إعفاء</button></div>

    <div className="card"><h2>تسجيل حضور يدوي</h2><p className="sub">للحالات الاستثنائية (تعطل الجوال مثلاً). الحالة تُحسب من إعدادات الموظف، والسبب إلزامي.</p>
      <div className="grid"><Field label="الموظف">{pick(man.userId, (v) => setMan({ ...man, userId: v }))}</Field><Field label="اليوم"><input type="date" value={man.date} onChange={(e) => setMan({ ...man, date: e.target.value })} /></Field>
        <Field label="وقت الحضور"><input type="time" value={man.time} onChange={(e) => setMan({ ...man, time: e.target.value })} /></Field><Field label="السبب"><input value={man.reason} onChange={(e) => setMan({ ...man, reason: e.target.value })} /></Field></div>
      <button className="btn primary" style={{ marginTop: 14 }} disabled={!man.userId || !man.date || !man.time || man.reason.trim().length < 3} onClick={async () => { if (await run(() => api('/attendance/manual', { method: 'POST', body: man }), 'تم تسجيل الحضور')) setMan({ userId: '', date: '', time: '', reason: '' }); }}>تسجيل</button></div>
  </>);
}
