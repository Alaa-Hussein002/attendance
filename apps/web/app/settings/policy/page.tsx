'use client';
import { useEffect, useMemo, useState } from 'react';
import { AttendancePolicy, DEFAULT_POLICY, DeductionRule, RedemptionRule, Tier, validatePolicy } from '@attendance/shared';
import { api } from '../../../lib/api';

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DED_TYPES: Record<DeductionRule['type'], string> = { FIXED: 'مبلغ ثابت', PER_MINUTE: 'مبلغ لكل دقيقة', SALARY_FRACTION: 'جزء من الراتب اليومي (1 = يوم كامل)', PERCENT_OF_SALARY: 'نسبة % من الراتب' };
const isMoney = (t: string) => t === 'FIXED' || t === 'PER_MINUTE';
// The engine stores money in halalas; HR sees riyals.
const show = (type: string, v: number) => (isMoney(type) ? v / 100 : v);
const store = (type: string, v: number) => (isMoney(type) ? Math.round(v * 100) : v);
const today = () => new Date().toISOString().slice(0, 10);

function Deduction({ d, onChange }: { d?: DeductionRule; onChange: (d: DeductionRule) => void }) {
  const cur = d ?? { type: 'FIXED' as const, value: 0 };
  return (<>
    <div><label>نوع الخصم</label>
      <select value={cur.type} onChange={(e) => { const t = e.target.value as DeductionRule['type']; onChange({ type: t, value: store(t, show(cur.type, cur.value)) }); }}>
        {Object.entries(DED_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    <div><label>القيمة {isMoney(cur.type) ? '(ريال)' : ''}</label>
      <input type="number" min={0} step="any" value={show(cur.type, cur.value)} onChange={(e) => onChange({ type: cur.type, value: store(cur.type, Number(e.target.value)) })} /></div>
  </>);
}

export default function PolicyPage() {
  const [p, setP] = useState<AttendancePolicy>(DEFAULT_POLICY);
  const [id, setId] = useState<string | null>(null);
  const [from, setFrom] = useState(today());
  const [msg, setMsg] = useState(''); const [apiErr, setApiErr] = useState(''); const [busy, setBusy] = useState(false);
  const errors = useMemo(() => validatePolicy(p), [p]);
  const edit = (fn: (x: AttendancePolicy) => void) => setP((old) => { const n = structuredClone(old); fn(n); return n; });

  useEffect(() => {
    api<any[]>('/policies').then((rows) => { const d = rows.find((r) => r.isDefault) ?? rows[0]; if (d) { setId(d.id); setP(d.config); } }).catch((e) => setApiErr(e.message));
  }, []);

  async function save() {
    setBusy(true); setMsg(''); setApiErr('');
    try {
      const r = id ? await api(`/policies/${id}`, { method: 'PUT', body: { config: p, effectiveFrom: from } })
                   : await api('/policies', { method: 'POST', body: { name: 'السياسة الافتراضية', config: p, effectiveFrom: from, isDefault: true } });
      setId(r.id); setMsg(`تم الحفظ (النسخة ${r.version})`);
    } catch (e: any) { setApiErr(e.message); }
    setBusy(false);
  }

  const allTiers: Tier[] = [...p.tiers, p.absentTier];
  const tierInput = (t: Tier, upd: (t: Tier) => void, withTime: boolean) => (
    <div className="row">
      <div><label>المفتاح</label><input value={t.key} onChange={(e) => upd({ ...t, key: e.target.value.trim().toUpperCase() })} /></div>
      <div><label>الاسم</label><input value={t.label} onChange={(e) => upd({ ...t, label: e.target.value })} /></div>
      <div><label>اللون</label><input type="color" value={t.color} onChange={(e) => upd({ ...t, color: e.target.value })} /></div>
      {withTime && <><div><label>النوع</label><select value={t.kind} onChange={(e) => upd({ ...t, kind: e.target.value as Tier['kind'] })}><option value="ON_TIME">في الوقت</option><option value="LATE">متأخر</option></select></div>
        <div><label>حتى الساعة</label><input type="time" value={t.until ?? ''} onChange={(e) => upd({ ...t, until: e.target.value })} /></div></>}
      {t.kind !== 'ON_TIME' && <Deduction d={t.deduction} onChange={(d) => upd({ ...t, deduction: d })} />}
    </div>);

  return (<>
    <h1>إعدادات الحضور والرواتب</h1>
    <p className="hint">كل القواعد هنا قابلة للتعديل. التعديل ينشئ نسخة جديدة ولا يغيّر الأشهر السابقة.</p>
    {apiErr && <div className="errors">{apiErr}</div>}

    <div className="card"><h2>الدوام</h2>
      <div className="row">
        <div><label>بداية الدوام (لحساب دقائق التأخير)</label><input type="time" value={p.shiftStart} onChange={(e) => edit((x) => { x.shiftStart = e.target.value; })} /></div>
        <div><label>قاسم الراتب اليومي</label><input type="number" min={1} value={p.salaryDivisor} onChange={(e) => edit((x) => { x.salaryDivisor = Number(e.target.value); })} /></div>
      </div>
      <label>أيام العطلة الأسبوعية</label>
      <div className="days">{DAYS.map((d, i) => (<label key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'inherit' }}>
        <input type="checkbox" checked={p.weeklyOffDays.includes(i)} onChange={(e) => edit((x) => { x.weeklyOffDays = e.target.checked ? [...x.weeklyOffDays, i].sort() : x.weeklyOffDays.filter((k) => k !== i); })} />{d}</label>))}</div>
    </div>

    <div className="card"><h2>مراحل الحضور (مرتبة من الأبكر إلى الأحدث)</h2>
      <div className="scroll">{p.tiers.map((t, i) => (<div key={i} style={{ borderBottom: '1px solid var(--line)', marginBottom: 8 }}>
        {tierInput(t, (n) => edit((x) => { x.tiers[i] = n; }), true)}
        <button onClick={() => edit((x) => { x.tiers.splice(i, 1); })}>حذف المرحلة</button></div>))}</div>
      <button onClick={() => edit((x) => { x.tiers.push({ key: `TIER${x.tiers.length + 1}`, label: 'مرحلة جديدة', color: '#eab308', kind: 'LATE', until: '12:00', deduction: { type: 'FIXED', value: 0 } }); })}>+ إضافة مرحلة</button>
      <h2 style={{ marginTop: 16 }}>مرحلة الغياب <span className="hint">(بدون تسجيل، أو بعد آخر مرحلة)</span></h2>
      {tierInput(p.absentTier, (n) => edit((x) => { x.absentTier = { ...n, kind: 'ABSENT' }; }), false)}
    </div>

    <div className="card"><h2>التعويض</h2>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'inherit' }}><input type="checkbox" checked={p.redemption.enabled} onChange={(e) => edit((x) => { x.redemption.enabled = e.target.checked; })} />تفعيل تعويض المراحل السيئة بنقاط جيدة</label>
      {p.redemption.enabled && <>
        <div className="row" style={{ marginTop: 10 }}>
          <div><label>أي يوم جيد يُستخدم؟</label><select value={p.redemption.policy} onChange={(e) => edit((x) => { x.redemption.policy = e.target.value as any; })}><option value="AFTER_ONLY">اللاحق لليوم السيئ فقط</option><option value="ANY">أي يوم في الشهر</option></select></div>
          <div><label>ترتيب المعالجة</label><select value={p.redemption.order} onChange={(e) => edit((x) => { x.redemption.order = e.target.value as any; })}><option value="CHRONOLOGICAL">الأقدم أولاً</option><option value="HIGHEST_DEDUCTION_FIRST">الأعلى خصماً أولاً</option></select></div>
          <div><label>حد أقصى شهري (فارغ = بلا حد)</label><input type="number" min={0} value={p.redemption.maxPerMonth ?? ''} onChange={(e) => edit((x) => { x.redemption.maxPerMonth = e.target.value === '' ? null : Number(e.target.value); })} /></div>
        </div>
        {p.redemption.rules.map((r, i) => (<div className="row" key={i}>
          <div><label>المرحلة المعوَّضة</label><select value={r.target} onChange={(e) => edit((x) => { x.redemption.rules[i].target = e.target.value; })}>{allTiers.filter((t) => t.kind !== 'ON_TIME').map((t) => <option key={t.key}>{t.key}</option>)}</select></div>
          <div><label>تُعوَّض بأيام من</label><select value={r.currency} onChange={(e) => edit((x) => { x.redemption.rules[i].currency = e.target.value; })}>{allTiers.filter((t) => t.kind === 'ON_TIME').map((t) => <option key={t.key}>{t.key}</option>)}</select></div>
          <div><label>عددها</label><input type="number" min={1} value={r.cost} onChange={(e) => edit((x) => { x.redemption.rules[i].cost = Number(e.target.value); })} /></div>
          <button onClick={() => edit((x) => { x.redemption.rules.splice(i, 1); })}>حذف</button></div>))}
        <button onClick={() => edit((x) => { x.redemption.rules.push({ target: x.absentTier.key, currency: x.tiers[0]?.key ?? '', cost: 1 } as RedemptionRule); })}>+ إضافة قاعدة</button></>}
    </div>

    <div className="card"><h2>مكافأة الالتزام</h2>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'inherit' }}><input type="checkbox" checked={p.bonus.enabled} onChange={(e) => edit((x) => { x.bonus.enabled = e.target.checked; })} />تفعيل المكافأة</label>
      {p.bonus.enabled && <div className="row" style={{ marginTop: 10 }}>
        <div><label>نوع المكافأة</label><select value={p.bonus.type} onChange={(e) => edit((x) => { const t = x.bonus.type; const v = t === 'FIXED' ? x.bonus.value / 100 : x.bonus.value; x.bonus.type = e.target.value as any; x.bonus.value = x.bonus.type === 'FIXED' ? Math.round(v * 100) : v; })}><option value="FIXED">مبلغ ثابت</option><option value="PERCENT">نسبة % من الراتب</option></select></div>
        <div><label>القيمة {p.bonus.type === 'FIXED' ? '(ريال)' : '(%)'}</label><input type="number" min={0} step="any" value={p.bonus.type === 'FIXED' ? p.bonus.value / 100 : p.bonus.value} onChange={(e) => edit((x) => { x.bonus.value = x.bonus.type === 'FIXED' ? Math.round(Number(e.target.value) * 100) : Number(e.target.value); })} /></div>
        <div><label>أيام سيئة مسموحة</label><input type="number" min={0} value={p.bonus.maxBadDays} onChange={(e) => edit((x) => { x.bonus.maxBadDays = Number(e.target.value); })} /></div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'inherit' }}><input type="checkbox" checked={p.bonus.allowsRedemption} onChange={(e) => edit((x) => { x.bonus.allowsRedemption = e.target.checked; })} />الأيام المعوَّضة لا تمنع المكافأة</label>
      </div>}
    </div>

    <div className="bar">
      <div><label>يسري من تاريخ</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <button className="primary" disabled={busy || errors.length > 0} onClick={save}>حفظ كنسخة جديدة</button>
      {msg && <span>{msg}</span>}
    </div>
    {errors.length > 0 && <div className="errors">{errors.map((e) => <div key={e}>{e}</div>)}</div>}
    <p className="hint">{allTiers.map((t) => <span key={t.key} style={{ marginInlineEnd: 14 }}><span className="chip" style={{ background: t.color }} />{t.label}</span>)}</p>
  </>);
}
