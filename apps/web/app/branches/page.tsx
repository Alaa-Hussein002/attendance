'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../components/Providers';
import { Field, PageHeader, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';

const MapPicker = dynamic(() => import('../../components/MapPicker'), { ssr: false, loading: () => <div className="map" /> });
const MODES: [string, string, string][] = [['GPS', 'الموقع (GPS)', 'يسجّل الحضور من داخل نطاق الفرع على الخريطة'], ['NETWORK', 'شبكة المكتب', 'يسجّل الحضور من داخل شبكة الواي فاي الخاصة بالمقر'], ['FINGERPRINT', 'جهاز البصمة', 'يُعتمد على جهاز البصمة في الفرع']];
const blank = { id: '', name: '', loc: null as null | { lat: number; lng: number }, radius: 150, ranges: '', modes: ['GPS'] as string[] };

export default function Branches() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]); const [f, setF] = useState(blank); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<any[]>('/branches').then(setRows).catch((e) => toast.error('تعذر التحميل', errText(e))), [toast]);
  useEffect(() => { load(); }, [load]);
  const edit = (b: any) => { setF({ id: b.id, name: b.name, loc: b.latitude != null ? { lat: Number(b.latitude), lng: Number(b.longitude) } : null, radius: b.radiusMeters ?? 150, ranges: (b.allowedIpRanges ?? []).join('\n'), modes: b.verificationModes }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const needLoc = f.modes.includes('GPS') && !f.loc;
  async function save() {
    setBusy(true);
    try {
      await api(f.id ? `/branches/${f.id}` : '/branches', { method: f.id ? 'PUT' : 'POST', body: { name: f.name, latitude: f.loc?.lat, longitude: f.loc?.lng, radiusMeters: f.loc ? f.radius : undefined, allowedIpRanges: f.ranges.split(/[\s,]+/).filter(Boolean), verificationModes: f.modes } });
      toast.success(f.id ? 'تم تحديث الفرع' : 'تمت إضافة الفرع'); setF(blank); setOpen(false); load();
    } catch (e) { toast.error('تعذر الحفظ', errText(e)); }
    setBusy(false);
  }
  return (<>
    <PageHeader title="الفروع" sub="حدّد موقع كل فرع على الخريطة وطريقة التحقق من الحضور." right={!open && <button className="btn primary" onClick={() => { setF(blank); setOpen(true); }}>+ فرع جديد</button>} />
    {open && (<div className="card"><h2>{f.id ? 'تعديل الفرع' : 'فرع جديد'}</h2>
      <div className="stack" style={{ marginTop: 14 }}>
        <Field label="اسم الفرع"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: المقر الرئيسي — جدة" /></Field>
        <div><div className="lbl">طرق التحقق من الحضور</div><div className="stack">{MODES.map(([k, t, d]) => (
          <div key={k} className="row" style={{ padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 14 }}><Switch checked={f.modes.includes(k)} onChange={(v) => setF({ ...f, modes: v ? [...f.modes, k] : f.modes.filter((m) => m !== k) })} /><div><b>{t}</b><div className="muted small">{d}</div></div></div>))}</div></div>
        {f.modes.includes('GPS') && (<div><div className="lbl">موقع الفرع</div><MapPicker value={f.loc} radius={f.radius} onChange={(loc) => setF((s) => ({ ...s, loc }))} />
          <div className="grid" style={{ marginTop: 14 }}><Field label={`نطاق الحضور حول الفرع: ${f.radius} متراً`}><input type="range" min={30} max={1000} step={10} value={f.radius} onChange={(e) => setF({ ...f, radius: Number(e.target.value) })} style={{ padding: 0 }} /></Field></div>
          {needLoc && <div className="alert warn">حدّد موقع الفرع على الخريطة لتفعيل الحضور بالموقع.</div>}</div>)}
        {f.modes.includes('NETWORK') && <Field label="نطاقات شبكة المكتب" help="أثناء الاتصال بواي فاي الفرع، اعرف عنوان IPv4 العام واكتبه هنا. مثال: 203.0.113.25/32. للنطاق الثابت اطلب CIDR من مسؤول الشبكة. لا تستخدم عناوين 192.168.x.x الداخلية."><textarea rows={3} dir="ltr" value={f.ranges} onChange={(e) => setF({ ...f, ranges: e.target.value })} /></Field>}
        <div className="row"><button className="btn primary" disabled={busy || !f.name.trim() || !f.modes.length || needLoc} onClick={save}>{f.id ? 'حفظ التعديل' : 'إضافة الفرع'}</button><button className="btn" onClick={() => { setOpen(false); setF(blank); }}>إلغاء</button></div>
      </div></div>)}
    <div className="card scroll">{!rows.length ? <div className="empty">لم تُضف فروعاً بعد. أضف أول فرع لتفعيل تسجيل الحضور.</div> : (
      <table><thead><tr><th>الفرع</th><th>طرق التحقق</th><th>الموقع</th><th /></tr></thead><tbody>{rows.map((b) => (
        <tr key={b.id}><td><b>{b.name}</b></td><td><div className="row" style={{ gap: 6 }}>{b.verificationModes.map((m: string) => <span key={m} className="badge">{MODES.find((x) => x[0] === m)?.[1] ?? m}</span>)}</div></td>
          <td>{b.latitude != null ? <span className="badge">📍 محدد · نطاق {b.radiusMeters} م</span> : <span className="muted">—</span>}</td><td style={{ textAlign: 'end' }}><button className="btn sm" onClick={() => edit(b)}>تعديل</button></td></tr>))}</tbody></table>)}</div>
  </>);
}
