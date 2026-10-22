'use client';
import { AttendancePolicy, calculateMonth, DeductionRule, RedemptionRule, Tier } from '@attendance/shared';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import ColorWheel from '../../components/ColorWheel';
import { useDialog, useMeta, useToast } from '../../components/Providers';
import { Field, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { DAY_KEYS, fmtDay, fmtTime12, tierLabel } from '../../lib/format';
import { byKey, DED, example, fromMin, MAX_TIERS, newKey, PALETTE, showVal, storeVal, tierFrom, tierIssue, toMin } from './helpers';

type Props = { p: AttendancePolicy; edit: (fn: (x: AttendancePolicy) => void) => void };

/* ---------------- deduction editor ---------------- */
function DeductionEditor({ d, onChange }: { d: DeductionRule; onChange: (d: DeductionRule) => void }) {
  const { t } = useI18n();
  return (<div className="grid">
    <Field label={t('w.tiers.type')}><select value={d.type} onChange={(e) => { const type = e.target.value as DeductionRule['type']; onChange({ type, value: storeVal(type, showVal(d)) }); }}>
      {Object.entries(DED).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}</select></Field>
    <Field label={t('w.tiers.value', { unit: t(DED[d.type].unit) })} help={t('w.tiers.example', { amount: example(d) })}>
      <input type="number" min={0} step="any" value={showVal(d)} onChange={(e) => onChange({ type: d.type, value: storeVal(d.type, Math.max(0, Number(e.target.value))) })} /></Field>
  </div>);
}

/* ---------------- timeline preview ---------------- */
function Timeline({ p }: { p: AttendancePolicy }) {
  const { t, locale } = useI18n();
  const s = toMin(p.shiftStart); const ends = p.tiers.map((tier) => (tier.until ? toMin(tier.until) : s));
  const segs = p.tiers.map((tier, i) => ({ t: tier, from: i ? ends[i - 1] : s, to: ends[i] }));
  const last = ends[ends.length - 1] ?? s;
  const all = [...segs.map((x) => ({ ...x, label: tierLabel(x.t.label, t) })), { t: p.absentTier, from: last, to: last + 60, label: tierLabel(p.absentTier.label, t) }];
  return (<div><div style={{ display: 'flex', height: 46, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
    {all.map((x, i) => <div key={i} title={x.label} style={{ flex: `${Math.max(x.to - x.from, 0)} 0 0`, background: x.t.color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}>{x.label}</div>)}</div>
    <div className="row small muted num" style={{ justifyContent: 'space-between', marginTop: 6 }}><span>{fmtTime12(p.shiftStart, locale)}</span><span>{fmtTime12(fromMin(last), locale)}</span></div></div>);
}

/* ---------------- tab: working hours + weekend + payroll period + holidays ---------------- */
export function HoursTab({ p, edit }: Props) {
  const { t, locale } = useI18n();
  const { meta } = useMeta(); const toast = useToast(); const { confirm } = useDialog();
  const year = meta ? Number(meta.today.slice(0, 4)) : new Date().getFullYear();
  const [holidays, setHolidays] = useState<any[]>([]); const [h, setH] = useState({ date: '', name: '' });
  const load = useCallback(() => api<any[]>(`/holidays?year=${year}`).then(setHolidays).catch((e) => toast.error(t('w.settings.holidays.loadError'), errText(e, t))), [year, toast, t]);
  useEffect(() => { load(); }, [load]);
  const sd = p.payrollStartDay;
  return (<>
    <div className="card"><h2>{t('w.settings.hours.title')}</h2><p className="sub">{t('w.settings.hours.sub')}</p>
      <div className="grid"><Field label={t('w.settings.hours.start')} help={fmtTime12(p.shiftStart, locale)}><input type="time" value={p.shiftStart} onChange={(e) => edit((x) => { x.shiftStart = e.target.value; })} /></Field>
        <Field label={t('w.settings.hours.tz')} help={t('w.settings.hours.tzHelp')}><input readOnly value={meta ? `${meta.timezone} · ${t('w.settings.hours.gregorian')}` : '...'} dir="ltr" /></Field></div></div>

    <div className="card"><h2>{t('w.settings.weekend.title')}</h2><p className="sub">{t('w.settings.weekend.sub')}</p>
      <div className="row">{DAY_KEYS.map((d, i) => <button key={d} type="button" className={`pill ${p.weeklyOffDays.includes(i) ? 'on' : ''}`}
        onClick={() => edit((x) => { x.weeklyOffDays = x.weeklyOffDays.includes(i) ? x.weeklyOffDays.filter((k) => k !== i) : [...x.weeklyOffDays, i].sort(); })}>{t(d)}</button>)}</div></div>

    <div className="card"><h2>{t('w.settings.payroll.title')}</h2><p className="sub">{t('w.settings.payroll.sub')}</p>
      <div className="grid"><Field label={t('w.settings.payroll.startDay')}><select value={sd} onChange={(e) => edit((x) => { x.payrollStartDay = Number(e.target.value); })}>
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select></Field></div>
      <div className="alert" style={{ marginTop: 12 }}>{sd === 1 ? t('w.settings.payroll.fullMonth') : t('w.settings.payroll.body', { day: sd, prev: sd - 1 })}</div></div>

    <div className="card"><h2>{t('w.settings.holidays.title')} <span className="num muted small">{year}</span></h2><p className="sub">{t('w.settings.holidays.sub')}</p>
      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 14 }}>
        <Field label={t('w.settings.holidays.date')}><input type="date" value={h.date} onChange={(e) => setH({ ...h, date: e.target.value })} /></Field>
        <div style={{ flex: 1, minWidth: 180 }}><Field label={t('w.settings.holidays.name')}><input value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} placeholder={t('w.settings.holidays.namePh')} /></Field></div>
        <button className="btn primary" disabled={!h.date || !h.name.trim()} onClick={async () => { try { await api('/holidays', { method: 'POST', body: h }); setH({ date: '', name: '' }); toast.success(t('w.settings.holidays.added')); load(); } catch (e) { toast.error(t('w.settings.saveError'), errText(e, t)); } }}>{t('w.settings.holidays.add')}</button></div>
      {holidays.length === 0 ? <div className="empty">{t('w.settings.holidays.empty')}</div> : (
        <table><tbody>{holidays.map((x) => <tr key={x.id}><td className="num" style={{ width: 200 }}>{fmtDay(x.date, t)}</td><td>{x.name}</td>
          <td style={{ textAlign: 'end' }}><button className="btn sm danger" onClick={async () => { if (await confirm({ title: t('w.settings.holidays.deleteTitle'), body: t('w.settings.holidays.deleteBody', { name: x.name, date: fmtDay(x.date, t) }), confirmText: t('common.delete'), danger: true })) { try { await api(`/holidays/${x.id}`, { method: 'DELETE' }); toast.success(t('w.settings.holidays.deleted')); load(); } catch (e) { toast.error(t('w.devices.deleteError'), errText(e, t)); } } }}>{t('common.delete')}</button></td></tr>)}</tbody></table>)}</div>
  </>);
}

/* ---------------- tab: attendance tiers ---------------- */
export function TiersTab({ p, edit }: Props) {
  const { t, locale } = useI18n();
  const setTier = (i: number, fn: (tier: Tier) => void) => edit((x) => { fn(x.tiers[i]); });
  const add = () => edit((x) => {
    const prev = x.tiers.length ? toMin(x.tiers[x.tiers.length - 1].until!) : toMin(x.shiftStart);
    const used = new Set([...x.tiers, x.absentTier].map((tier) => tier.color));
    x.tiers.push({ key: newKey(), label: t('w.tiers.newTier'), color: PALETTE.find((c) => !used.has(c)) ?? '#2f6fed', kind: 'LATE', until: fromMin(prev + 15), deduction: { type: 'FIXED', value: 0 } });
  });
  return (<>
    <div className="card"><h2>{t('w.tiers.title')}</h2><p className="sub">{t('w.tiers.sub', { max: MAX_TIERS })}</p>
      <Timeline p={p} /></div>

    {p.tiers.map((tier, i) => { const issue = tierIssue(p, i); const from = tierFrom(p, i); const shown = tierLabel(tier.label, t); return (
      <div className="tier" key={tier.key}><span className="bar" style={{ background: tier.color }} />
        <div className="tier-head"><span className="dot" style={{ background: tier.color, width: 14, height: 14 }} /><b>{t('w.tiers.tier', { n: i + 1 })}</b><span className="muted small">— {t(tier.kind === 'ON_TIME' ? 'w.tiers.onTime' : 'w.tiers.late')}</span>
          <span style={{ flex: 1 }} /><button className="btn sm danger" disabled={p.tiers.length === 1} onClick={() => edit((x) => { x.tiers.splice(i, 1); })}>{t('w.tiers.delete')}</button></div>
        <div className="grid">
          <Field label={t('w.tiers.name')} error={!tier.label.trim() ? t('w.tiers.nameRequired') : undefined}><input value={shown} onChange={(e) => setTier(i, (z) => { z.label = e.target.value; })} placeholder={t('w.tiers.namePh')} className={!tier.label.trim() ? 'bad' : ''} /></Field>
          <Field label={t('w.tiers.from')}><input readOnly dir="ltr" value={`${from}  ·  ${fmtTime12(from, locale)}`} /></Field>
          <Field label={t('w.tiers.to')} error={issue && tier.label.trim() ? t(issue) : undefined}><input type="time" value={tier.until ?? ''} className={issue && tier.label.trim() ? 'bad' : ''} onChange={(e) => setTier(i, (z) => { z.until = e.target.value; })} /></Field>
        </div>
        <div><div className="lbl">{t('w.tiers.what')}</div>
          <div className="seg" role="group"><button type="button" className={tier.kind === 'ON_TIME' ? 'on' : ''} onClick={() => setTier(i, (z) => { z.kind = 'ON_TIME'; delete z.deduction; })}>{t('w.tiers.onTimeOpt')}</button>
            <button type="button" className={tier.kind === 'LATE' ? 'on' : ''} onClick={() => setTier(i, (z) => { z.kind = 'LATE'; z.deduction ??= { type: 'FIXED', value: 0 }; })}>{t('w.tiers.lateOpt')}</button></div></div>
        {tier.kind === 'LATE' && <DeductionEditor d={tier.deduction ?? { type: 'FIXED', value: 0 }} onChange={(d) => setTier(i, (z) => { z.deduction = d; })} />}
        <div><div className="lbl">{t('w.tiers.color')}</div><ColorWheel value={tier.color} onChange={(c) => setTier(i, (z) => { z.color = c; })} /></div>
      </div>); })}

    <div style={{ margin: '4px 0 18px' }}><button className="btn" disabled={p.tiers.length >= MAX_TIERS} onClick={add}>+ {t('w.tiers.add')}</button>
      {p.tiers.length >= MAX_TIERS && <span className="muted small" style={{ marginInlineStart: 10 }}>{t('w.tiers.maxReached', { max: MAX_TIERS })}</span>}</div>

    <div className="tier"><span className="bar" style={{ background: p.absentTier.color }} />
      <div className="tier-head"><span className="dot" style={{ background: p.absentTier.color, width: 14, height: 14 }} /><b>{t('w.tiers.absence')}</b><span className="muted small">{t('w.tiers.absenceSub', { time: fmtTime12(p.tiers[p.tiers.length - 1]?.until ?? p.shiftStart, locale) })}</span></div>
      <div className="grid"><Field label={t('w.tiers.name')}><input value={tierLabel(p.absentTier.label, t)} onChange={(e) => edit((x) => { x.absentTier.label = e.target.value; })} /></Field></div>
      <DeductionEditor d={p.absentTier.deduction ?? { type: 'SALARY_FRACTION', value: 1 }} onChange={(d) => edit((x) => { x.absentTier.deduction = d; })} />
      <div><div className="lbl">{t('w.tiers.color')}</div><ColorWheel value={p.absentTier.color} onChange={(c) => edit((x) => { x.absentTier.color = c; })} /></div></div>
  </>);
}

/* ---------------- tab: redemption ---------------- */
function Simulation({ p }: { p: AttendancePolicy }) {
  const { t } = useI18n();
  const late = p.tiers.find((tier) => tier.kind === 'LATE'); const good = p.tiers.find((tier) => tier.kind === 'ON_TIME');
  if (!late || !good || !p.redemption.enabled || !p.redemption.rules.some((r) => r.target === late.key)) return <div className="muted small">{t('w.redemption.simNeed')}</div>;
  const rec = (d: number, tier: Tier) => ({ date: `2026-06-${String(d).padStart(2, '0')}`, checkInMinutes: toMin(tier.until!) });
  const r = calculateMonth({ year: 2026, month: 6, baseSalary: 300000, policy: { ...p, payrollStartDay: 1, weeklyOffDays: [], bonus: { ...p.bonus, enabled: false } },
    records: [rec(1, late), rec(2, late), rec(3, late), rec(4, good), rec(5, good)], asOfDate: '2026-06-05' });
  const days = r.days.slice(0, 5);
  return (<div><div className="muted small" style={{ marginBottom: 8 }}>{t('w.redemption.simExample', { late: tierLabel(late.label, t), good: tierLabel(good.label, t) })}</div>
    <div className="row">{days.map((d, i) => { const tier = byKey(p, d.status); return (<div key={i} className="badge" style={{ background: tier?.color, color: '#fff', padding: '8px 12px', opacity: d.redeemed ? .55 : 1, textDecoration: d.redeemed ? 'line-through' : 'none' }}>
      {t('w.redemption.simDay', { n: i + 1, label: tier ? tierLabel(tier.label, t) : d.status })}{d.redeemed ? t('w.redemption.simRedeemed') : ''}</div>); })}</div>
    <div className="small" style={{ marginTop: 8 }}>{t('w.redemption.simCount', { count: r.redemptions.length })} · {t('w.redemption.simRemaining', { amount: (r.totalDeductions / 100).toFixed(2) })}</div></div>);
}
export function RedemptionTab({ p, edit }: Props) {
  const { t } = useI18n();
  const good = p.tiers.filter((tier) => tier.kind === 'ON_TIME'); const bad = [...p.tiers.filter((tier) => tier.kind === 'LATE'), p.absentTier];
  const rule = (k: string) => p.redemption.rules.find((r) => r.target === k);
  const setRule = (k: string, fn: (r: RedemptionRule) => void) => edit((x) => { const r = x.redemption.rules.find((q) => q.target === k); if (r) fn(r); });
  return (<>
    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><div><h2>{t('w.redemption.title')}</h2><p className="sub" style={{ margin: 0 }}>{t('w.redemption.sub')}</p></div>
      <Switch checked={p.redemption.enabled} onChange={(v) => edit((x) => { x.redemption.enabled = v; })} /></div></div>
    {p.redemption.enabled && (<>
      <div className="card"><h2>{t('w.redemption.rules')}</h2><p className="sub">{t('w.redemption.rulesSub')}</p>
        <div className="stack">{bad.map((tier) => { const r = rule(tier.key); return (
          <div key={tier.key} className="row" style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 14, gap: 14 }}>
            <Switch checked={!!r} onChange={(v) => edit((x) => { if (v) x.redemption.rules.push({ target: tier.key, currency: good[0]?.key ?? '', cost: 1 }); else x.redemption.rules = x.redemption.rules.filter((q) => q.target !== tier.key); })} />
            <span className="badge" style={{ background: tier.color, color: '#fff' }}>{tierLabel(tier.label, t)}</span>
            {r ? (<><span>{t('w.redemption.by')}</span><input type="number" min={1} style={{ width: 80 }} value={r.cost} onChange={(e) => setRule(tier.key, (z) => { z.cost = Math.max(1, Math.floor(Number(e.target.value) || 1)); })} />
              <span>{r.cost === 1 ? t('w.redemption.dayOne') : t('w.redemption.dayMany')}</span><span>{t('w.redemption.fromTier')}</span><select style={{ width: 'auto', minWidth: 140 }} value={r.currency} onChange={(e) => setRule(tier.key, (z) => { z.currency = e.target.value; })}>{good.map((g) => <option key={g.key} value={g.key}>{tierLabel(g.label, t)}</option>)}</select></>) : <span className="muted small">{t('w.redemption.none')}</span>}
          </div>); })}</div></div>
      <div className="card"><h2>{t('w.redemption.options')}</h2><div className="grid" style={{ marginTop: 12 }}>
        <Field label={t('w.redemption.policy')}><select value={p.redemption.policy} onChange={(e) => edit((x) => { x.redemption.policy = e.target.value as any; })}><option value="AFTER_ONLY">{t('w.redemption.policyAfter')}</option><option value="ANY">{t('w.redemption.policyAny')}</option></select></Field>
        <Field label={t('w.redemption.order')}><select value={p.redemption.order} onChange={(e) => edit((x) => { x.redemption.order = e.target.value as any; })}><option value="LATEST_FIRST">{t('w.redemption.orderLatest')}</option><option value="CHRONOLOGICAL">{t('w.redemption.orderChron')}</option><option value="HIGHEST_DEDUCTION_FIRST">{t('w.redemption.orderHighest')}</option></select></Field>
        <Field label={t('w.redemption.max')} help={t('w.redemption.maxHelp')}><input type="number" min={0} value={p.redemption.maxPerMonth ?? ''} placeholder={t('w.redemption.noLimit')} onChange={(e) => edit((x) => { x.redemption.maxPerMonth = e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))); })} /></Field></div></div>
      <div className="card"><h2>{t('w.redemption.how')}</h2><p className="sub">{t('w.redemption.howSub')}</p><Simulation p={p} /></div></>)}
  </>);
}

/* ---------------- tab: commitment bonus ---------------- */
export function BonusTab({ p, edit }: Props) {
  const { t } = useI18n();
  const b = p.bonus; const all = [...p.tiers, p.absentTier]; const q = byKey(p, b.qualifyingTier);
  const free = all.filter((tier) => tier.key !== b.qualifyingTier && !b.allowances.some((a) => a.tier === tier.key));
  const money = b.type === 'FIXED';
  const amount = money ? t('w.bonus.fixedAmount', { amount: (b.value / 100).toFixed(2) }) : t('w.bonus.percentAmount', { value: b.value });
  const lateTier = p.tiers.find((tier) => tier.kind === 'LATE');
  const lateName = lateTier ? tierLabel(lateTier.label, t) : t('w.tier.default.RED');
  const allowanceItems = b.allowances.map((a) => `${a.days} ${a.days === 1 ? t('w.redemption.dayOne') : t('w.redemption.dayMany')} «${tierLabel(byKey(p, a.tier)?.label ?? '', t)}»`).join(t('w.common.and'));
  return (<>
    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><div><h2>{t('w.bonus.title')}</h2><p className="sub" style={{ margin: 0 }}>{t('w.bonus.sub')}</p></div>
      <Switch checked={b.enabled} onChange={(v) => edit((x) => { x.bonus.enabled = v; })} /></div></div>
    {b.enabled && (<>
      <div className="card"><h2>{t('w.bonus.value')}</h2><div className="grid" style={{ marginTop: 12 }}>
        <Field label={t('w.bonus.type')}><div className="seg"><button type="button" className={money ? 'on' : ''} onClick={() => edit((x) => { if (x.bonus.type !== 'FIXED') { x.bonus.type = 'FIXED'; x.bonus.value = 0; } })}>{t('w.bonus.fixed')}</button>
          <button type="button" className={!money ? 'on' : ''} onClick={() => edit((x) => { if (x.bonus.type !== 'PERCENT') { x.bonus.type = 'PERCENT'; x.bonus.value = 0; } })}>{t('w.bonus.percent')}</button></div></Field>
        <Field label={money ? t('w.bonus.amount') : t('w.bonus.percentVal')}><input type="number" min={0} step="any" value={money ? b.value / 100 : b.value} onChange={(e) => edit((x) => { const n = Math.max(0, Number(e.target.value)); x.bonus.value = x.bonus.type === 'FIXED' ? Math.round(n * 100) : Math.min(100, n); })} /></Field></div></div>
      <div className="card"><h2>{t('w.bonus.qualifying')}</h2><p className="sub">{t('w.bonus.qualifyingSub')}</p>
        <Field label={t('w.bonus.tier')}><select value={b.qualifyingTier} onChange={(e) => edit((x) => { x.bonus.qualifyingTier = e.target.value; })}>{p.tiers.map((tier) => <option key={tier.key} value={tier.key}>{tierLabel(tier.label, t)}</option>)}</select></Field></div>
      <div className="card"><h2>{t('w.bonus.allowances')}</h2><p className="sub">{t('w.bonus.allowancesSub', { tier: lateName })}</p>
        <div className="stack">{b.allowances.map((a, i) => (<div key={a.tier} className="row">
          <select style={{ width: 'auto', minWidth: 160 }} value={a.tier} onChange={(e) => edit((x) => { x.bonus.allowances[i].tier = e.target.value; })}>{[byKey(p, a.tier)!, ...free].map((tier) => <option key={tier.key} value={tier.key}>{tierLabel(tier.label, t)}</option>)}</select>
          <span>{t('w.bonus.allowed')}</span><input type="number" min={1} style={{ width: 80 }} value={a.days} onChange={(e) => edit((x) => { x.bonus.allowances[i].days = Math.max(1, Math.floor(Number(e.target.value) || 1)); })} /><span>{t('w.bonus.days')}</span>
          <button className="btn sm danger" onClick={() => edit((x) => { x.bonus.allowances.splice(i, 1); })}>{t('w.bonus.delete')}</button></div>))}
          <div><button className="btn" disabled={!free.length} onClick={() => edit((x) => { x.bonus.allowances.push({ tier: free[0].key, days: 1 }); })}>+ {t('w.bonus.addAllowance')}</button></div></div>
        <div style={{ marginTop: 18 }}><Switch checked={b.allowsRedemption} onChange={(v) => edit((x) => { x.bonus.allowsRedemption = v; })} label={t('w.bonus.redemptionSwitch')} />
          <div className="muted small" style={{ marginTop: 6 }}>{t('w.bonus.redemptionOn', { tier: q ? tierLabel(q.label, t) : '' })}</div></div></div>
      <div className="alert ok"><span>✓</span><span>{t('w.bonus.summary', { amount, tier: q ? tierLabel(q.label, t) : '', allowances: b.allowances.length ? t('w.bonus.allowancesSummary', { items: allowanceItems }) : t('w.bonus.noDelay') })}</span></div></>)}
  </>);
}
