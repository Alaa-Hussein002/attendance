'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import { useDialog, useMeta, useToast } from '../../components/Providers';
import { PageHeader, Spinner } from '../../components/ui';
import { api, download } from '../../lib/api';
import { ApiError, errText } from '../../lib/errors';
import { fmtDay, fmtTime12, MONTH_KEYS, roleLabel, sar, tierLabel } from '../../lib/format';

const NEUTRAL: Record<string, { key: string; bg: string }> = {
  HOLIDAY: { key: 'neutral.HOLIDAY', bg: '#94a3b8' },
  WEEKEND: { key: 'neutral.WEEKEND', bg: '#cfcbc0' },
  ON_LEAVE: { key: 'neutral.ON_LEAVE', bg: '#6aa0f5' },
  EXCUSED: { key: 'neutral.EXCUSED', bg: '#a78bfa' },
  FUTURE: { key: 'neutral.FUTURE', bg: 'transparent' },
  INACTIVE: { key: 'neutral.INACTIVE', bg: '#e5e2d9' },
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const tierOf = (c: any, st: string) => [...c.policy.tiers, c.policy.absentTier].find((tier: any) => tier.key === st);

function Detail({ c, onClose }: { c: any; onClose: () => void }) {
  const { t, locale } = useI18n();
  const r = c.result; const row = c.row; const tiers = [...c.policy.tiers, c.policy.absentTier];
  const exceeded = r.bonusExceeded ?? [];
  const sep = t('w.common.listSep');
  const bonusText = r.bonusEligible ? t('w.reports.bonusEligible', { amount: sar(r.bonus) })
    : !r.finalized ? t('w.reports.bonusPending')
    : exceeded.length ? t('w.reports.bonusMissed', {
      items: exceeded.map((e: any) => t('w.reports.missedItem', {
        label: tierLabel(tiers.find((tier: any) => tier.key === e.tier)?.label ?? e.tier, t),
        count: e.count,
        allowed: e.allowed,
      })).join(sep),
    }) : t('w.reports.bonusNone');
  const look = (st: string) => {
    const tier = tierOf(c, st);
    const neutral = NEUTRAL[st];
    if (tier) return { label: tierLabel(tier.label, t), color: tier.color, neutral: false };
    if (neutral) return { label: t(neutral.key), color: neutral.bg, neutral: true };
    return { label: st, color: '#999', neutral: true };
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal wide" role="dialog" aria-modal>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h3 style={{ marginBottom: 2 }}>{c.name}</h3><div className="muted small">{roleLabel(c.role, t)} · {t('w.reports.period', { from: fmtDay(r.period.from, t), to: fmtDay(r.period.to, t), days: r.period.days })}</div></div><button className="btn sm" onClick={onClose}>{t('w.reports.close')}</button></div>
      <div className="grid" style={{ margin: '18px 0' }}>
        <div className="card" style={{ margin: 0, padding: 14 }}><div className="muted small">{t('w.reports.baseSalary')}</div><b className="num" style={{ fontSize: 20 }}>{sar(row.baseSalaryMinor)}</b></div>
        <div className="card" style={{ margin: 0, padding: 14 }}><div className="muted small">{t('w.reports.deductions')}</div><b className="num" style={{ fontSize: 20, color: 'var(--bad)' }}>{sar(row.lateDeductionsMinor + row.absentDeductionsMinor)}</b></div>
        <div className="card" style={{ margin: 0, padding: 14 }}><div className="muted small">{t('w.reports.bonus')}</div><b className="num" style={{ fontSize: 20, color: 'var(--ok)' }}>{sar(row.bonusMinor)}</b></div>
        <div className="card" style={{ margin: 0, padding: 14, background: 'var(--black)', color: 'var(--paper)' }}><div className="small" style={{ opacity: .7 }}>{t('w.reports.netSalary')}</div><b className="num" style={{ fontSize: 20 }}>{sar(row.netSalaryMinor)}</b></div></div>
      <div className={`alert ${r.bonusEligible ? 'ok' : ''}`} style={{ marginBottom: 14 }}><span>{r.bonusEligible ? '★' : 'ⓘ'}</span><span>{bonusText}</span></div>
      <div className="row" style={{ marginBottom: 12, gap: 8 }}>{tiers.map((tier: any) => <span key={tier.key} className="badge" style={{ background: tier.color, color: '#fff' }}>{tierLabel(tier.label, t)}: <span className="num">{r.counts[tier.key] ?? 0}</span></span>)}{r.counts.REDEEMED > 0 && <span className="badge">{t('w.reports.redeemedDays', { count: r.counts.REDEEMED })}</span>}</div>
      <div className="scroll" style={{ maxHeight: '44vh', border: '1px solid var(--line)', borderRadius: 14 }}><table><thead><tr><th>{t('w.reports.day')}</th><th>{t('w.leaves.status')}</th><th>{t('w.reports.checkIn')}</th><th>{t('w.reports.deduction')}</th><th>{t('w.reports.note')}</th></tr></thead><tbody>
        {r.days.map((d: any) => { const { label, color, neutral } = look(d.status); return (
          <tr key={d.date} style={{ opacity: d.status === 'FUTURE' ? .4 : 1 }}><td className="num">{fmtDay(d.date, t)}</td>
            <td><span className="badge" style={{ background: neutral ? 'var(--soft)' : color, color: neutral ? 'var(--black)' : '#fff' }}>{neutral && <span className="dot" style={{ background: color, border: '1px solid var(--line)' }} />}{label}</span></td>
            <td className="num">{d.checkInMinutes != null ? fmtTime12(hhmm(d.checkInMinutes), locale) : '—'}</td>
            <td className="num">{d.deduction > 0 ? <span style={{ color: d.redeemed ? 'var(--muted)' : 'var(--bad)', textDecoration: d.redeemed ? 'line-through' : 'none' }}>{sar(d.deduction)}</span> : '—'}</td>
            <td className="small muted">{d.redeemed ? t('w.reports.redeemedBy', { dates: d.redeemedBy.map((x: string) => fmtDay(x, t)).join(sep) }) : d.lateMinutes ? t('w.reports.lateMinutes', { minutes: d.lateMinutes }) : ''}</td></tr>); })}
        <tr style={{ background: 'var(--soft)' }}><td colSpan={3}><b>{t('w.reports.periodBonus')}</b></td><td className="num"><b style={{ color: 'var(--ok)' }}>{r.bonus ? sar(r.bonus) : '—'}</b></td><td className="small muted">{r.bonusEligible ? t('w.reports.earned') : ''}</td></tr>
      </tbody></table></div></div></div>);
}

export default function Reports() {
  const { t } = useI18n();
  const toast = useToast(); const { notice, confirm } = useDialog(); const { meta } = useMeta();
  const [year, setYear] = useState<number | null>(null); const [month, setMonth] = useState<number | null>(null);
  const [data, setData] = useState<any[] | null>(null); const [busy, setBusy] = useState(false); const [sel, setSel] = useState<any | null>(null);
  useEffect(() => { if (meta && year === null) { setYear(meta.payrollMonth.year); setMonth(meta.payrollMonth.month); } }, [meta, year]);
  const load = useCallback(async () => { if (year === null || month === null) return; setBusy(true); try { setData(await api(`/reports/monthly?year=${year}&month=${month}`)); } catch (e) { toast.error(t('w.reports.loadError'), errText(e, t)); setData(null); } setBusy(false); }, [year, month, toast, t]);
  useEffect(() => { load(); }, [load]);

  const tiers: any[] = data?.[0] ? [...data[0].policy.tiers, data[0].policy.absentTier] : [];
  const period = data?.[0]?.result.period;
  const finished = !!data?.length && data.every((c) => c.result.finalized);
  const totals = useMemo(() => (data ?? []).reduce((a, c) => ({ ded: a.ded + c.row.lateDeductionsMinor + c.row.absentDeductionsMinor, bonus: a.bonus + c.row.bonusMinor, net: a.net + c.row.netSalaryMinor }), { ded: 0, bonus: 0, net: 0 }), [data]);
  const years = meta ? Array.from({ length: 5 }, (_, i) => meta.payrollMonth.year - 3 + i) : [];

  const notFinished = (end: string) => notice({ tone: 'warn', title: t('w.reports.notFinishedTitle'), body: t('w.reports.notFinishedBody', { date: fmtDay(end, t) }) });
  async function close() {
    if (!period) return;
    if (!finished) return notFinished(period.to);
    if (!(await confirm({ title: t('w.reports.closeTitle'), body: t('w.reports.closeBody', { month: t(MONTH_KEYS[(month ?? 1) - 1]), year: String(year) }), confirmText: t('w.reports.closeConfirm') }))) return;
    try { const r = await api('/reports/close', { method: 'POST', body: { year, month } }); toast.success(t('w.reports.closeDone'), t('w.reports.closeDoneBody', { count: r.closed })); }
    catch (e) { if (e instanceof ApiError && (e.code === 'PERIOD_NOT_FINISHED' || e.code === 'MONTH_NOT_FINISHED')) notFinished(e.data?.periodEnd ?? period.to); else toast.error(t('w.reports.closeError'), errText(e, t)); }
  }
  async function csv() { try { await download(`/reports/payroll.csv?year=${year}&month=${month}`, `payroll-${year}-${String(month).padStart(2, '0')}.csv`); toast.success(t('w.reports.csvDone')); } catch (e) { toast.error(t('w.reports.exportError'), errText(e, t)); } }

  const summary: [string, string, string][] = [
    [t('w.reports.employees'), String(data?.length ?? 0), ''],
    [t('w.reports.totalDeductions'), sar(totals.ded), 'var(--bad)'],
    [t('w.reports.totalBonus'), sar(totals.bonus), 'var(--ok)'],
    [t('w.reports.netSalaries'), sar(totals.net), ''],
  ];

  return (<>
    <PageHeader title={t('w.reports.title')} sub={period ? t('w.reports.period', { from: fmtDay(period.from, t), to: fmtDay(period.to, t), days: period.days }) : t('w.reports.choose')}
      right={<><button className="btn" disabled={!data?.length} onClick={csv}>{t('w.reports.exportCsv')}</button><button className="btn primary" disabled={!data?.length} onClick={close}>{t('w.reports.closePeriod')}</button></>} />
    <div className="card"><div className="row" style={{ gap: 14, alignItems: 'flex-end' }}>
      <div style={{ width: 150 }}><label className="lbl">{t('w.reports.year')}</label><select value={year ?? ''} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
      <div style={{ width: 200 }}><label className="lbl">{t('w.reports.month')}</label><select value={month ?? ''} onChange={(e) => setMonth(Number(e.target.value))}>{MONTH_KEYS.map((m, i) => <option key={m} value={i + 1}>{t(m)}</option>)}</select></div>
      {busy && <Spinner />}</div></div>

    {data && data.length > 0 && (<>
      <div className="grid" style={{ marginBottom: 18 }}>
        {summary.map(([l, v, c]) => (
          <div key={l} className="card" style={{ margin: 0, padding: 16 }}><div className="muted small">{l}</div><div className="num" style={{ fontSize: 24, fontWeight: 700, color: c || undefined }}>{v}</div></div>))}</div>
      <div className="card scroll" style={{ padding: 8 }}><table><thead><tr><th>{t('w.reports.employee')}</th>{tiers.map((tier) => <th key={tier.key}><span className="dot" style={{ background: tier.color, marginInlineEnd: 6 }} />{tierLabel(tier.label, t)}</th>)}<th>{t('w.reports.redeemed')}</th><th>{t('w.reports.deductions')}</th><th>{t('w.reports.bonus')}</th><th>{t('w.reports.net')}</th></tr></thead><tbody>
        {data.map((c) => (<tr key={c.userId} className="click" onClick={() => setSel(c)}><td><b>{c.name}</b><div className="muted small">{roleLabel(c.role, t)}</div></td>
          {tiers.map((tier) => <td key={tier.key} className="num">{c.result.counts[tier.key] ?? 0}</td>)}<td className="num">{c.row.redeemedDays}</td>
          <td className="num" style={{ color: 'var(--bad)' }}>{c.row.lateDeductionsMinor + c.row.absentDeductionsMinor ? sar(c.row.lateDeductionsMinor + c.row.absentDeductionsMinor) : '—'}</td>
          <td className="num" style={{ color: 'var(--ok)' }}>{c.row.bonusMinor ? sar(c.row.bonusMinor) : '—'}</td><td className="num"><b>{sar(c.row.netSalaryMinor)}</b></td></tr>))}</tbody></table>
        <div className="muted small" style={{ padding: '10px 12px' }}>{t('w.reports.clickHint')}</div></div></>)}
    {data && data.length === 0 && !busy && <div className="card empty">{t('w.reports.noEmployees')}</div>}
    {sel && <Detail c={sel} onClose={() => setSel(null)} />}
  </>);
}
