'use client';
import { useCallback, useEffect, useState } from 'react';
import { useDialog, useToast } from '../../components/Providers';
import { Field, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';

const blank = { id: '', branchId: '', name: '', brand: 'ZKTECO', model: '', host: '', port: '4370', serialNumber: '', notes: '', active: true };
const ago = (iso?: string | null) => { if (!iso) return 'لم يتصل بعد'; const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); return s < 90 ? 'الآن' : s < 3600 ? `قبل ${Math.round(s / 60)} د` : s < 86400 ? `قبل ${Math.round(s / 3600)} س` : `قبل ${Math.round(s / 86400)} يوم`; };
const Stat = ({ v, l, c }: { v: number | string; l: string; c?: string }) => <div style={{ background: 'var(--soft)', borderRadius: 14, padding: '10px 14px', minWidth: 96 }}><div className="num" style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div><div className="muted small">{l}</div></div>;

export default function DevicesTab() {
  const toast = useToast(); const { confirm } = useDialog();
  const [rows, setRows] = useState<any[]>([]); const [branches, setBranches] = useState<any[]>([]); const [emps, setEmps] = useState<any[]>([]); const [unm, setUnm] = useState<any[]>([]);
  const [f, setF] = useState(blank); const [busy, setBusy] = useState(false); const [key, setKey] = useState<{ name: string; value: string } | null>(null); const [open, setOpen] = useState(false);
  const load = useCallback(() => Promise.all([api<any[]>('/biometric-devices'), api<any[]>('/branches'), api<any[]>('/employees'), api<any[]>('/biometric-devices/unmapped')])
    .then(([d, b, e, u]) => { setRows(d); setBranches(b); setEmps(e.filter((x) => x.active && x.tracksAttendance)); setUnm(u); }).catch((e) => toast.error('تعذر التحميل', errText(e))), [toast]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try { const r = await api(f.id ? `/biometric-devices/${f.id}` : '/biometric-devices', { method: f.id ? 'PUT' : 'POST', body: { ...f, port: Number(f.port) } });
      toast.success(f.id ? 'تم تحديث الجهاز' : 'تمت إضافة الجهاز'); if (r.apiKey) setKey({ name: f.name, value: r.apiKey }); setF(blank); setOpen(false); load(); }
    catch (e) { toast.error('تعذر الحفظ', errText(e)); }
    setBusy(false);
  }
  const rotate = async (d: any) => { if (!(await confirm({ title: 'إنشاء مفتاح جديد؟', body: 'سيتوقف البرنامج الوسيط الحالي عن العمل حتى تضع المفتاح الجديد فيه.', confirmText: 'إنشاء مفتاح', danger: true }))) return; try { const r = await api(`/biometric-devices/${d.id}/key`, { method: 'POST' }); setKey({ name: d.name, value: r.apiKey }); } catch (e) { toast.error('تعذر التنفيذ', errText(e)); } };
  const mapId = async (u: any, userId: string) => {
    if (!userId) return;
    try { await api(`/employees/${userId}`, { method: 'PUT', body: { biometricId: u.biometricId } }); const r = await api('/biometric-devices/reprocess', { method: 'POST' }); toast.success('تم ربط البصمة بالموظف', r.applied ? `طُبّقت ${r.applied} بصمة سابقة` : ''); load(); } catch (e) { toast.error('تعذر الربط', errText(e)); }
  };

  return (<>
    {key && (<div className="overlay"><div className="modal"><h3>مفتاح الربط — {key.name}</h3>
      <p className="muted">ضع هذا المفتاح في إعدادات البرنامج الوسيط على الكمبيوتر القريب من الجهاز. <b>يظهر مرة واحدة فقط</b>؛ إن فقدته أنشئ مفتاحاً جديداً.</p>
      <input readOnly dir="ltr" value={key.value} onFocus={(e) => e.target.select()} style={{ fontFamily: 'monospace', fontSize: 13 }} />
      <div className="actions"><button className="btn primary" onClick={() => { navigator.clipboard?.writeText(key.value); toast.success('تم النسخ'); }}>نسخ المفتاح</button><button className="btn" onClick={() => setKey(null)}>تم</button></div></div></div>)}

    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}><div><h2 style={{ fontSize: 18 }}>أجهزة البصمة</h2><div className="muted small">بصمة اليد والعين (مثل ZKTeco). يقرؤها برنامج وسيط على شبكة المقر ويرسلها للنظام.</div></div>
      {!open && <button className="btn primary" onClick={() => { setF(blank); setOpen(true); }}>+ جهاز جديد</button>}</div>

    {open && (<div className="card"><h2>{f.id ? 'تعديل جهاز' : 'إضافة جهاز بصمة'}</h2>
      <div className="grid" style={{ marginTop: 12 }}>
        <Field label="الفرع"><select value={f.branchId} onChange={set('branchId')}><option value="">— اختر —</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="اسم الجهاز"><input value={f.name} onChange={set('name')} placeholder="مثال: بوابة المقر الرئيسي" /></Field>
        <Field label="الطراز"><input value={f.model} onChange={set('model')} dir="ltr" placeholder="iClock / SpeedFace / MB460" /></Field>
        <Field label="عنوان الجهاز (IP)"><input value={f.host} onChange={set('host')} dir="ltr" placeholder="192.168.1.201" /></Field>
        <Field label="المنفذ"><input type="number" value={f.port} onChange={set('port')} /></Field>
        <Field label="الرقم التسلسلي"><input value={f.serialNumber} onChange={set('serialNumber')} dir="ltr" /></Field>
        <Field label="ملاحظات"><input value={f.notes} onChange={set('notes')} /></Field></div>
      {f.id && <div style={{ marginTop: 12 }}><Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="الجهاز مفعّل" /></div>}
      <div className="row" style={{ marginTop: 16 }}><button className="btn primary" disabled={busy || !f.branchId || !f.name.trim() || !f.host.trim()} onClick={save}>{f.id ? 'حفظ التعديل' : 'إضافة وإنشاء مفتاح الربط'}</button><button className="btn" onClick={() => { setOpen(false); setF(blank); }}>إلغاء</button></div></div>)}

    {!rows.length && !open && <div className="card empty">لم تُضف أجهزة بعد.</div>}
    {rows.map((d) => (<div className="card" key={d.id}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><div className="row"><span className="dot" style={{ background: d.online ? 'var(--ok)' : '#b9b6ad', width: 12, height: 12 }} /><b style={{ fontSize: 17 }}>{d.name}</b><span className="badge">{d.online ? 'متصل' : d.active ? 'غير متصل' : 'موقوف'}</span></div>
          <div className="muted small" style={{ marginTop: 4 }}>{branches.find((b) => b.id === d.branchId)?.name} · <span className="num">{d.host}:{d.port}</span> · {d.brand} {d.model}</div></div>
        <div className="row" style={{ gap: 6 }}><button className="btn sm" onClick={() => { setF({ id: d.id, branchId: d.branchId, name: d.name, brand: d.brand, model: d.model ?? '', host: d.host, port: String(d.port), serialNumber: d.serialNumber ?? '', notes: d.notes ?? '', active: d.active }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>تعديل</button>
          <button className="btn sm" onClick={() => rotate(d)}>مفتاح جديد</button>
          <button className="btn sm danger" onClick={async () => { if (await confirm({ title: 'حذف الجهاز؟', body: `${d.name} — يُحذف سجل بصماته أيضاً.`, confirmText: 'حذف', danger: true })) { try { await api(`/biometric-devices/${d.id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); } catch (e) { toast.error('تعذر الحذف', errText(e)); } } }}>حذف</button></div></div>
      <div className="row" style={{ marginTop: 14, gap: 10 }}>
        <Stat v={d.today.total} l="بصمات اليوم" /><Stat v={d.today.recorded} l="حضور مسجّل" c="var(--ok)" /><Stat v={d.today.duplicate} l="مكررة" /><Stat v={d.today.unmapped} l="غير مرتبطة" c={d.today.unmapped ? 'var(--bad)' : undefined} /><Stat v={d.totalPunches} l="إجمالي البصمات" />
        <div style={{ marginInlineStart: 'auto' }} className="small muted"><div>آخر اتصال: {ago(d.lastSeenAt)}</div><div>آخر مزامنة: {ago(d.lastSyncAt)}</div>
          {d.clockOffsetMs != null && <div style={{ color: Math.abs(d.clockOffsetMs) > 300000 ? 'var(--bad)' : undefined }}>ساعة الجهاز: {Math.abs(d.clockOffsetMs) < 60000 ? 'مضبوطة' : `فرق ${Math.round(d.clockOffsetMs / 60000)} دقيقة`}</div>}</div></div>
      {!d.hasKey && <div className="alert warn" style={{ marginTop: 12 }}>لا يوجد مفتاح ربط لهذا الجهاز. اضغط «مفتاح جديد».</div>}
    </div>))}

    {unm.length > 0 && (<div className="card"><h2>بصمات غير مرتبطة بموظف <span className="badge" style={{ background: '#fdebe4' }}>{unm.length}</span></h2><p className="sub">أرقام ظهرت على الجهاز ولا يملكها أي موظف. اربط كل رقم بموظفه، وتُطبّق بصماته السابقة تلقائياً.</p>
      <table><thead><tr><th>رقم البصمة</th><th>الجهاز</th><th>عدد البصمات</th><th>الربط بموظف</th></tr></thead><tbody>{unm.map((u) => (
        <tr key={u.deviceId + u.biometricId}><td className="num"><b>{u.biometricId}</b></td><td>{u.deviceName}</td><td className="num">{u.punches}</td>
          <td><select defaultValue="" onChange={(e) => mapId(u, e.target.value)}><option value="">— اختر الموظف —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}{e.biometricId ? ` (حالياً ${e.biometricId})` : ''}</option>)}</select></td></tr>))}</tbody></table></div>)}

    <div className="card"><h2>تشغيل البرنامج الوسيط</h2><p className="sub">يعمل على كمبيوتر في نفس شبكة الجهاز، ويبقى شغّالاً.</p>
      <ol style={{ lineHeight: 2, margin: 0, paddingInlineStart: 22 }}><li>ثبّت Node.js 20 على ذلك الكمبيوتر وانسخ مجلد <b className="num">apps/agent</b>.</li><li>أنشئ ملف <b className="num">.env</b> فيه: <span className="num" dir="ltr">API_URL</span> و<span className="num" dir="ltr">DEVICE_KEY</span> (مفتاح الجهاز أعلاه) و<span className="num" dir="ltr">DEVICE_HOST</span> و<span className="num" dir="ltr">DEVICE_PORT</span>.</li><li>شغّل: <span className="num" dir="ltr">npm install && npm start</span>. سيظهر الجهاز «متصلاً» خلال دقيقة.</li><li>في صفحة الموظفين اكتب «رقم البصمة» لكل موظف كما هو مسجل على الجهاز.</li></ol></div>
  </>);
}
