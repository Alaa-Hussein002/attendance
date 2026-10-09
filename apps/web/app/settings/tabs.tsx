'use client';
import { AttendancePolicy, calculateMonth, DeductionRule, RedemptionRule, Tier } from '@attendance/shared';
import { useCallback, useEffect, useState } from 'react';
import ColorWheel from '../../components/ColorWheel';
import { useDialog, useMeta, useToast } from '../../components/Providers';
import { Field, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { DAYS_AR, fmtDay, fmtTime12, MONTHS_AR } from '../../lib/format';
import { byKey, DED, example, fromMin, MAX_TIERS, newKey, PALETTE, showVal, storeVal, tierFrom, tierIssue, toMin } from './helpers';

type Props = { p: AttendancePolicy; edit: (fn: (x: AttendancePolicy) => void) => void };

/* ---------------- deduction editor ---------------- */
function DeductionEditor({ d, onChange }: { d: DeductionRule; onChange: (d: DeductionRule) => void }) {
  return (<div className="grid">
    <Field label="نوع الخصم"><select value={d.type} onChange={(e) => { const t = e.target.value as DeductionRule['type']; onChange({ type: t, value: storeVal(t, showVal(d)) }); }}>
      {Object.entries(DED).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
    <Field label={`القيمة (${DED[d.type].unit})`} help={`مثال على راتب 3000 ريال: ${example(d)} ريال`}>
      <input type="number" min={0} step="any" value={showVal(d)} onChange={(e) => onChange({ type: d.type, value: storeVal(d.type, Math.max(0, Number(e.target.value))) })} /></Field>
  </div>);
}

/* ---------------- timeline preview ---------------- */
function Timeline({ p }: { p: AttendancePolicy }) {
  const s = toMin(p.shiftStart); const ends = p.tiers.map((t) => (t.until ? toMin(t.until) : s));
  const segs = p.tiers.map((t, i) => ({ t, from: i ? ends[i - 1] : s, to: ends[i] }));
  const last = ends[ends.length - 1] ?? s; const total = Math.max(last - s + 60, 60);
  const all = [...segs.map((x) => ({ ...x, label: x.t.label })), { t: p.absentTier, from: last, to: last + 60, label: p.absentTier.label }];
  return (<div><div style={{ display: 'flex', height: 46, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
    {all.map((x, i) => <div key={i} title={x.label} style={{ flex: `${Math.max(x.to - x.from, 0)} 0 0`, background: x.t.color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}>{x.label}</div>)}</div>
    <div className="row small muted num" style={{ justifyContent: 'space-between', marginTop: 6 }}><span>{fmtTime12(p.shiftStart)}</span><span>{fmtTime12(fromMin(last))}</span><span>{total > 0 ? '' : ''}</span></div></div>);
}

/* ---------------- tab: working hours + weekend + payroll period + holidays ---------------- */
export function HoursTab({ p, edit }: Props) {
  const { meta } = useMeta(); const toast = useToast(); const { confirm } = useDialog();
  const year = meta ? Number(meta.today.slice(0, 4)) : new Date().getFullYear();
  const [holidays, setHolidays] = useState<any[]>([]); const [h, setH] = useState({ date: '', name: '' });
  const load = useCallback(() => api<any[]>(`/holidays?year=${year}`).then(setHolidays).catch((e) => toast.error('تعذر تحميل العطل', errText(e))), [year, toast]);
  useEffect(() => { load(); }, [load]);
  const sd = p.payrollStartDay;
  return (<>
    <div className="card"><h2>الدوام الرسمي</h2><p className="sub">وقت بداية الدوام. تُقاس به مراحل الحضور وحساب دقائق التأخير.</p>
      <div className="grid"><Field label="بداية الدوام" help={fmtTime12(p.shiftStart)}><input type="time" value={p.shiftStart} onChange={(e) => edit((x) => { x.shiftStart = e.target.value; })} /></Field>
        <Field label="المنطقة الزمنية والتقويم" help="يُحدَّد عند تهيئة النظام. كل التواريخ ميلادية بتوقيت هذه المنطقة."><input readOnly value={meta ? `${meta.timezone} · ميلادي` : '...'} dir="ltr" /></Field></div></div>

    <div className="card"><h2>العطلة الأسبوعية</h2><p className="sub">أيام لا تُحتسب حضوراً ولا غياباً.</p>
      <div className="row">{DAYS_AR.map((d, i) => <button key={i} type="button" className={`pill ${p.weeklyOffDays.includes(i) ? 'on' : ''}`}
        onClick={() => edit((x) => { x.weeklyOffDays = x.weeklyOffDays.includes(i) ? x.weeklyOffDays.filter((k) => k !== i) : [...x.weeklyOffDays, i].sort(); })}>{d}</button>)}</div></div>

    <div className="card"><h2>شهر الرواتب</h2><p className="sub">اليوم الذي تبدأ منه فترة الحضور والرواتب كل شهر.</p>
      <div className="grid"><Field label="تبدأ الفترة يوم"><select value={sd} onChange={(e) => edit((x) => { x.payrollStartDay = Number(e.target.value); })}>
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select></Field></div>
      <div className="alert" style={{ marginTop: 12 }}>{sd === 1 ? 'الفترة = الشهر الميلادي كاملاً.' : <>كل فترة تبدأ يوم <b className="num">{sd}</b> وتنتهي يوم <b className="num">{sd - 1}</b> من الشهر التالي، وتُسمّى باسم الشهر الذي تنتهي فيه. وأجر اليوم يُحسب تلقائياً بحسب عدد أيام الفترة.</>}</div></div>

    <div className="card"><h2>العطل الرسمية <span className="num muted small">{year}</span></h2><p className="sub">تُضاف فوراً ولا تُحتسب على أي موظف.</p>
      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 14 }}>
        <Field label="التاريخ"><input type="date" value={h.date} onChange={(e) => setH({ ...h, date: e.target.value })} /></Field>
        <div style={{ flex: 1, minWidth: 180 }}><Field label="اسم العطلة"><input value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} placeholder="مثال: اليوم الوطني" /></Field></div>
        <button className="btn primary" disabled={!h.date || !h.name.trim()} onClick={async () => { try { await api('/holidays', { method: 'POST', body: h }); setH({ date: '', name: '' }); toast.success('تمت إضافة العطلة'); load(); } catch (e) { toast.error('تعذر الحفظ', errText(e)); } }}>إضافة</button></div>
      {holidays.length === 0 ? <div className="empty">لا توجد عطل مسجّلة لهذه السنة.</div> : (
        <table><tbody>{holidays.map((x) => <tr key={x.id}><td className="num" style={{ width: 200 }}>{fmtDay(x.date)}</td><td>{x.name}</td>
          <td style={{ textAlign: 'end' }}><button className="btn sm danger" onClick={async () => { if (await confirm({ title: 'حذف العطلة؟', body: `${x.name} — ${fmtDay(x.date)}`, confirmText: 'حذف', danger: true })) { try { await api(`/holidays/${x.id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); } catch (e) { toast.error('تعذر الحذف', errText(e)); } } }}>حذف</button></td></tr>)}</tbody></table>)}</div>
  </>);
}

/* ---------------- tab: attendance tiers ---------------- */
export function TiersTab({ p, edit }: Props) {
  const setTier = (i: number, fn: (t: Tier) => void) => edit((x) => { fn(x.tiers[i]); });
  const add = () => edit((x) => {
    const prev = x.tiers.length ? toMin(x.tiers[x.tiers.length - 1].until!) : toMin(x.shiftStart);
    const used = new Set([...x.tiers, x.absentTier].map((t) => t.color));
    x.tiers.push({ key: newKey(), label: 'مرحلة جديدة', color: PALETTE.find((c) => !used.has(c)) ?? '#2f6fed', kind: 'LATE', until: fromMin(prev + 15), deduction: { type: 'FIXED', value: 0 } });
  });
  return (<>
    <div className="card"><h2>مراحل الحضور</h2><p className="sub">كل مرحلة فترة زمنية تبدأ من نهاية السابقة (والأولى من بداية الدوام). حتى {MAX_TIERS} مراحل. ما بعد آخر مرحلة يُعدّ غياباً.</p>
      <Timeline p={p} /></div>

    {p.tiers.map((t, i) => { const issue = tierIssue(p, i); const from = tierFrom(p, i); return (
      <div className="tier" key={t.key}><span className="bar" style={{ background: t.color }} />
        <div className="tier-head"><span className="dot" style={{ background: t.color, width: 14, height: 14 }} /><b>المرحلة {i + 1}</b><span className="muted small">— {t.kind === 'ON_TIME' ? 'حضور' : 'تأخير'}</span>
          <span style={{ flex: 1 }} /><button className="btn sm danger" disabled={p.tiers.length === 1} onClick={() => edit((x) => { x.tiers.splice(i, 1); })}>حذف</button></div>
        <div className="grid">
          <Field label="اسم المرحلة" error={!t.label.trim() ? 'اسم المرحلة مطلوب' : undefined}><input value={t.label} onChange={(e) => setTier(i, (z) => { z.label = e.target.value; })} placeholder="مثال: منضبط" className={!t.label.trim() ? 'bad' : ''} /></Field>
          <Field label="من (تلقائي)"><input readOnly dir="ltr" value={`${from}  ·  ${fmtTime12(from)}`} /></Field>
          <Field label="إلى" error={issue && t.label.trim() ? issue : undefined}><input type="time" value={t.until ?? ''} className={issue && t.label.trim() ? 'bad' : ''} onChange={(e) => setTier(i, (z) => { z.until = e.target.value; })} /></Field>
        </div>
        <div><div className="lbl">ماذا يحدث في هذه المرحلة؟</div>
          <div className="seg" role="group"><button type="button" className={t.kind === 'ON_TIME' ? 'on' : ''} onClick={() => setTier(i, (z) => { z.kind = 'ON_TIME'; delete z.deduction; })}>حضور في الوقت</button>
            <button type="button" className={t.kind === 'LATE' ? 'on' : ''} onClick={() => setTier(i, (z) => { z.kind = 'LATE'; z.deduction ??= { type: 'FIXED', value: 0 }; })}>تأخير (خصم)</button></div></div>
        {t.kind === 'LATE' && <DeductionEditor d={t.deduction ?? { type: 'FIXED', value: 0 }} onChange={(d) => setTier(i, (z) => { z.deduction = d; })} />}
        <div><div className="lbl">لون المرحلة</div><ColorWheel value={t.color} onChange={(c) => setTier(i, (z) => { z.color = c; })} /></div>
      </div>); })}

    <div style={{ margin: '4px 0 18px' }}><button className="btn" disabled={p.tiers.length >= MAX_TIERS} onClick={add}>+ إضافة مرحلة</button>
      {p.tiers.length >= MAX_TIERS && <span className="muted small" style={{ marginInlineStart: 10 }}>وصلت للحد الأقصى ({MAX_TIERS} مراحل)</span>}</div>

    <div className="tier"><span className="bar" style={{ background: p.absentTier.color }} />
      <div className="tier-head"><span className="dot" style={{ background: p.absentTier.color, width: 14, height: 14 }} /><b>الغياب</b><span className="muted small">— لا حضور بعد الساعة <b className="num">{fmtTime12(p.tiers[p.tiers.length - 1]?.until ?? p.shiftStart)}</b></span></div>
      <div className="grid"><Field label="اسم المرحلة"><input value={p.absentTier.label} onChange={(e) => edit((x) => { x.absentTier.label = e.target.value; })} /></Field></div>
      <DeductionEditor d={p.absentTier.deduction ?? { type: 'SALARY_FRACTION', value: 1 }} onChange={(d) => edit((x) => { x.absentTier.deduction = d; })} />
      <div><div className="lbl">لون المرحلة</div><ColorWheel value={p.absentTier.color} onChange={(c) => edit((x) => { x.absentTier.color = c; })} /></div></div>
  </>);
}

/* ---------------- tab: redemption ---------------- */
function Simulation({ p }: { p: AttendancePolicy }) {
  const late = p.tiers.find((t) => t.kind === 'LATE'); const good = p.tiers.find((t) => t.kind === 'ON_TIME');
  if (!late || !good || !p.redemption.enabled || !p.redemption.rules.some((r) => r.target === late.key)) return <div className="muted small">فعّل قاعدة تعويض لإحدى مراحل التأخير لتظهر المحاكاة.</div>;
  const rec = (d: number, t: Tier) => ({ date: `2026-06-${String(d).padStart(2, '0')}`, checkInMinutes: toMin(t.until!) });
  const r = calculateMonth({ year: 2026, month: 6, baseSalary: 300000, policy: { ...p, payrollStartDay: 1, weeklyOffDays: [], bonus: { ...p.bonus, enabled: false } },
    records: [rec(1, late), rec(2, late), rec(3, late), rec(4, good), rec(5, good)], asOfDate: '2026-06-05' });
  const days = r.days.slice(0, 5);
  return (<div><div className="muted small" style={{ marginBottom: 8 }}>مثال: ثلاثة أيام «{late.label}» ثم يومان «{good.label}»</div>
    <div className="row">{days.map((d, i) => { const t = byKey(p, d.status); return (<div key={i} className="badge" style={{ background: t?.color, color: '#fff', padding: '8px 12px', opacity: d.redeemed ? .55 : 1, textDecoration: d.redeemed ? 'line-through' : 'none' }}>
      يوم {i + 1}: {t?.label}{d.redeemed ? ' ✓ عُوِّض' : ''}</div>); })}</div>
    <div className="small" style={{ marginTop: 8 }}>عدد الأيام المعوَّضة: <b className="num">{r.redemptions.length}</b> · الخصم المتبقي على راتب 3000: <b className="num">{(r.totalDeductions / 100).toFixed(2)}</b> ريال</div></div>);
}
export function RedemptionTab({ p, edit }: Props) {
  const good = p.tiers.filter((t) => t.kind === 'ON_TIME'); const bad = [...p.tiers.filter((t) => t.kind === 'LATE'), p.absentTier];
  const rule = (k: string) => p.redemption.rules.find((r) => r.target === k);
  const setRule = (k: string, fn: (r: RedemptionRule) => void) => edit((x) => { const r = x.redemption.rules.find((q) => q.target === k); if (r) fn(r); });
  return (<>
    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><div><h2>تعويض الأيام</h2><p className="sub" style={{ margin: 0 }}>كل يوم يلتزم فيه الموظف يُعوّض يوماً سابقاً متأخراً أو غائباً. وكل يوم يُستخدم في التعويض مرة واحدة فقط.</p></div>
      <Switch checked={p.redemption.enabled} onChange={(v) => edit((x) => { x.redemption.enabled = v; })} /></div></div>
    {p.redemption.enabled && (<>
      <div className="card"><h2>قواعد التعويض</h2><p className="sub">اختر المراحل التي يمكن تعويضها، وكم يوماً التزاماً يلزم لتعويض اليوم الواحد منها.</p>
        <div className="stack">{bad.map((t) => { const r = rule(t.key); return (
          <div key={t.key} className="row" style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 14, gap: 14 }}>
            <Switch checked={!!r} onChange={(v) => edit((x) => { if (v) x.redemption.rules.push({ target: t.key, currency: good[0]?.key ?? '', cost: 1 }); else x.redemption.rules = x.redemption.rules.filter((q) => q.target !== t.key); })} />
            <span className="badge" style={{ background: t.color, color: '#fff' }}>{t.label}</span>
            {r ? (<><span>يُعوَّض بـ</span><input type="number" min={1} style={{ width: 80 }} value={r.cost} onChange={(e) => setRule(t.key, (z) => { z.cost = Math.max(1, Math.floor(Number(e.target.value) || 1)); })} />
              <span>{r.cost === 1 ? 'يوم' : 'أيام'} من مرحلة</span><select style={{ width: 'auto', minWidth: 140 }} value={r.currency} onChange={(e) => setRule(t.key, (z) => { z.currency = e.target.value; })}>{good.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></>) : <span className="muted small">غير قابلة للتعويض</span>}
          </div>); })}</div></div>
      <div className="card"><h2>خيارات التطبيق</h2><div className="grid" style={{ marginTop: 12 }}>
        <Field label="أي يوم يصلح للتعويض؟"><select value={p.redemption.policy} onChange={(e) => edit((x) => { x.redemption.policy = e.target.value as any; })}><option value="AFTER_ONLY">يأتي بعد اليوم المتأخر فقط</option><option value="ANY">أي يوم في الفترة</option></select></Field>
        <Field label="أي يوم متأخر يُعوَّض أولاً؟"><select value={p.redemption.order} onChange={(e) => edit((x) => { x.redemption.order = e.target.value as any; })}><option value="LATEST_FIRST">الأحدث أولاً (أمس ثم ما قبله)</option><option value="CHRONOLOGICAL">الأقدم أولاً</option><option value="HIGHEST_DEDUCTION_FIRST">الأعلى خصماً أولاً</option></select></Field>
        <Field label="حد أقصى للتعويض في الفترة" help="اتركه فارغاً للسماح بلا حد"><input type="number" min={0} value={p.redemption.maxPerMonth ?? ''} placeholder="بلا حد" onChange={(e) => edit((x) => { x.redemption.maxPerMonth = e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))); })} /></Field></div></div>
      <div className="card"><h2>كيف سيعمل؟</h2><p className="sub">محاكاة حيّة بإعداداتك الحالية.</p><Simulation p={p} /></div></>)}
  </>);
}

/* ---------------- tab: commitment bonus ---------------- */
export function BonusTab({ p, edit }: Props) {
  const b = p.bonus; const all = [...p.tiers, p.absentTier]; const q = byKey(p, b.qualifyingTier);
  const free = all.filter((t) => t.key !== b.qualifyingTier && !b.allowances.some((a) => a.tier === t.key));
  const money = b.type === 'FIXED';
  return (<>
    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><div><h2>مكافأة الالتزام</h2><p className="sub" style={{ margin: 0 }}>تُمنح في نهاية الفترة لمن التزم طوال الشهر بالمرحلة المطلوبة.</p></div>
      <Switch checked={b.enabled} onChange={(v) => edit((x) => { x.bonus.enabled = v; })} /></div></div>
    {b.enabled && (<>
      <div className="card"><h2>قيمة المكافأة</h2><div className="grid" style={{ marginTop: 12 }}>
        <Field label="النوع"><div className="seg"><button type="button" className={money ? 'on' : ''} onClick={() => edit((x) => { if (x.bonus.type !== 'FIXED') { x.bonus.type = 'FIXED'; x.bonus.value = 0; } })}>مبلغ ثابت</button>
          <button type="button" className={!money ? 'on' : ''} onClick={() => edit((x) => { if (x.bonus.type !== 'PERCENT') { x.bonus.type = 'PERCENT'; x.bonus.value = 0; } })}>نسبة من الراتب</button></div></Field>
        <Field label={money ? 'المبلغ (ريال)' : 'النسبة (%)'}><input type="number" min={0} step="any" value={money ? b.value / 100 : b.value} onChange={(e) => edit((x) => { const n = Math.max(0, Number(e.target.value)); x.bonus.value = x.bonus.type === 'FIXED' ? Math.round(n * 100) : Math.min(100, n); })} /></Field></div></div>
      <div className="card"><h2>المرحلة المطلوبة</h2><p className="sub">يجب أن تكون كل أيام عمل الموظف في هذه المرحلة، إلا ما سمحتَ به أدناه.</p>
        <Field label="المرحلة"><select value={b.qualifyingTier} onChange={(e) => edit((x) => { x.bonus.qualifyingTier = e.target.value; })}>{p.tiers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></Field></div>
      <div className="card"><h2>أيام السماح</h2><p className="sub">عدد الأيام المسموح بها في مراحل أخرى دون فقدان المكافأة. مثال: «{p.tiers.find((t) => t.kind === 'LATE')?.label ?? 'متأخر'}» لمدة 3 أيام.</p>
        <div className="stack">{b.allowances.map((a, i) => (<div key={a.tier} className="row">
          <select style={{ width: 'auto', minWidth: 160 }} value={a.tier} onChange={(e) => edit((x) => { x.bonus.allowances[i].tier = e.target.value; })}>{[byKey(p, a.tier)!, ...free].map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
          <span>يُسمح بـ</span><input type="number" min={1} style={{ width: 80 }} value={a.days} onChange={(e) => edit((x) => { x.bonus.allowances[i].days = Math.max(1, Math.floor(Number(e.target.value) || 1)); })} /><span>أيام</span>
          <button className="btn sm danger" onClick={() => edit((x) => { x.bonus.allowances.splice(i, 1); })}>حذف</button></div>))}
          <div><button className="btn" disabled={!free.length} onClick={() => edit((x) => { x.bonus.allowances.push({ tier: free[0].key, days: 1 }); })}>+ إضافة سماح</button></div></div>
        <div style={{ marginTop: 18 }}><Switch checked={b.allowsRedemption} onChange={(v) => edit((x) => { x.bonus.allowsRedemption = v; })} label="الأيام المعوَّضة لا تمنع المكافأة" />
          <div className="muted small" style={{ marginTop: 6 }}>عند التفعيل: يوم متأخر تم تعويضه بيوم ملتزم يُحسب كأنه «{q?.label}»، فلا يحرم الموظف من المكافأة. عند الإيقاف: يُحسب متأخراً رغم تعويض خصمه.</div></div></div>
      <div className="alert ok"><span>✓</span><span>يحصل الموظف على <b>{money ? `${(b.value / 100).toFixed(2)} ريال` : `${b.value}% من راتبه`}</b> إذا كانت كل أيام عمله «<b>{q?.label}</b>»{b.allowances.length ? <>، مع سماح بـ {b.allowances.map((a) => `${a.days} ${a.days === 1 ? 'يوم' : 'أيام'} «${byKey(p, a.tier)?.label}»`).join(' و ')}</> : ' دون أي تأخير'}.</span></div></>)}
  </>);
}
