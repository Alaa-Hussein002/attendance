'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDialog, useMeta, useToast } from '../../components/Providers';
import { PageHeader, Spinner } from '../../components/ui';
import { api, download } from '../../lib/api';
import { ApiError, errText } from '../../lib/errors';
import { fmtDay, fmtTime12, MONTHS_AR, ROLE_AR, sar } from '../../lib/format';

const NEUTRAL: Record<string, [string, string]> = { HOLIDAY: ['عطلة رسمية', '#94a3b8'], WEEKEND: ['عطلة أسبوعية', '#cfcbc0'], ON_LEAVE: ['إجازة', '#6aa0f5'], EXCUSED: ['معفى بعذر', '#a78bfa'], FUTURE: ['قادم', 'transparent'] };
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const tierOf = (c: any, st: string) => [...c.policy.tiers, c.policy.absentTier].find((t: any) => t.key === st);
const look = (c: any, st: string): [string, string] => { const t = tierOf(c, st); return t ? [t.label, t.color] : NEUTRAL[st] ?? [st, '#999']; };

function Detail({ c, onClose }: { c: any; onClose: () => void }) {
  const r = c.result; const row = c.row; const tiers = [...c.policy.tiers, c.policy.absentTier];
  const exceeded = r.bonusExceeded ?? [];
  const bonusText = r.bonusEligible ? `استحق مكافأة الالتزام: ${sar(r.bonus)} ريال`
    : !r.finalized ? 'تُحسب المكافأة بعد انتهاء الفترة' : exceeded.length ? `لم يستحق المكافأة: ${exceeded.map((e: any) => `«${tiers.find((t: any) => t.key === e.tier)?.label}» ${e.count} أيام (المسموح ${e.allowed})`).join('، ')}` : 'لا مكافأة لهذه الفترة';
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal wide" role="dialog" aria-modal>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h3 style={{ marginBottom: 2 }}>{c.name}</h3><div className="muted small">{ROLE_AR[c.role] ?? c.role} · الفترة من <span className="num">{fmtDay(r.period.from)}</span> إلى <span className="num">{fmtDay(r.period.to)}</span></div></div><button className="btn sm" onClick={onClose}>إغلاق</button></div>
      <div className="grid" style={{ margin: '18px 0' }}>
        <div className="card" style={{ margin: 0, padding: 14 }}><div className="muted small">الراتب الأساسي</div><b className="num" style={{ fontSize: 20 }}>{sar(row.baseSalaryMinor)}</b></div>
        <div className="card" style={{ margin: 0, padding: 14 }}><div className="muted small">الخصومات</div><b className="num" style={{ fontSize: 20, color: 'var(--bad)' }}>{sar(row.lateDeductionsMinor + row.absentDeductionsMinor)}</b></div>
        <div className="card" style={{ margin: 0, padding: 14 }}><div className="muted small">مكافأة الالتزام</div><b className="num" style={{ fontSize: 20, color: 'var(--ok)' }}>{sar(row.bonusMinor)}</b></div>
        <div className="card" style={{ margin: 0, padding: 14, background: 'var(--black)', color: 'var(--paper)' }}><div className="small" style={{ opacity: .7 }}>صافي الراتب</div><b className="num" style={{ fontSize: 20 }}>{sar(row.netSalaryMinor)}</b></div></div>
      <div className={`alert ${r.bonusEligible ? 'ok' : ''}`} style={{ marginBottom: 14 }}><span>{r.bonusEligible ? '★' : 'ⓘ'}</span><span>{bonusText}</span></div>
      <div className="row" style={{ marginBottom: 12, gap: 8 }}>{tiers.map((t: any) => <span key={t.key} className="badge" style={{ background: t.color, color: '#fff' }}>{t.label}: <span className="num">{r.counts[t.key] ?? 0}</span></span>)}{r.counts.REDEEMED > 0 && <span className="badge">أيام معوَّضة: <span className="num">{r.counts.REDEEMED}</span></span>}</div>
      <div className="scroll" style={{ maxHeight: '44vh', border: '1px solid var(--line)', borderRadius: 14 }}><table><thead><tr><th>اليوم</th><th>الحالة</th><th>وقت الحضور</th><th>الخصم</th><th>ملاحظة</th></tr></thead><tbody>
        {r.days.map((d: any) => { const [lab, col] = look(c, d.status); const neutral = !!NEUTRAL[d.status]; return (
          <tr key={d.date} style={{ opacity: d.status === 'FUTURE' ? .4 : 1 }}><td className="num">{fmtDay(d.date)}</td>
            <td><span className="badge" style={{ background: neutral ? 'var(--soft)' : col, color: neutral ? 'var(--black)' : '#fff' }}>{neutral && <span className="dot" style={{ background: col, border: '1px solid var(--line)' }} />}{lab}</span></td>
            <td className="num">{d.checkInMinutes != null ? fmtTime12(hhmm(d.checkInMinutes)) : '—'}</td>
            <td className="num">{d.deduction > 0 ? <span style={{ color: d.redeemed ? 'var(--muted)' : 'var(--bad)', textDecoration: d.redeemed ? 'line-through' : 'none' }}>{sar(d.deduction)}</span> : '—'}</td>
            <td className="small muted">{d.redeemed ? `عُوِّض بيوم ${d.redeemedBy.map((x: string) => fmtDay(x)).join('، ')}` : d.lateMinutes ? `متأخر ${d.lateMinutes} دقيقة` : ''}</td></tr>); })}
        <tr style={{ background: 'var(--soft)' }}><td colSpan={3}><b>مكافأة الالتزام للفترة كاملة</b></td><td className="num"><b style={{ color: 'var(--ok)' }}>{r.bonus ? sar(r.bonus) : '—'}</b></td><td className="small muted">{r.bonusEligible ? 'مستحقة' : ''}</td></tr>
      </tbody></table></div></div></div>);
}

export default function Reports() {
  const toast = useToast(); const { notice, confirm } = useDialog(); const { meta } = useMeta();
  const [year, setYear] = useState<number | null>(null); const [month, setMonth] = useState<number | null>(null);
  const [data, setData] = useState<any[] | null>(null); const [busy, setBusy] = useState(false); const [sel, setSel] = useState<any | null>(null);
  useEffect(() => { if (meta && year === null) { setYear(meta.payrollMonth.year); setMonth(meta.payrollMonth.month); } }, [meta, year]);
  const load = useCallback(async () => { if (year === null || month === null) return; setBusy(true); try { setData(await api(`/reports/monthly?year=${year}&month=${month}`)); } catch (e) { toast.error('تعذر تحميل التقرير', errText(e)); setData(null); } setBusy(false); }, [year, month, toast]);
  useEffect(() => { load(); }, [load]);

  const tiers: any[] = data?.[0] ? [...data[0].policy.tiers, data[0].policy.absentTier] : [];
  const period = data?.[0]?.result.period;
  const finished = !!data?.length && data.every((c) => c.result.finalized);
  const totals = useMemo(() => (data ?? []).reduce((a, c) => ({ ded: a.ded + c.row.lateDeductionsMinor + c.row.absentDeductionsMinor, bonus: a.bonus + c.row.bonusMinor, net: a.net + c.row.netSalaryMinor }), { ded: 0, bonus: 0, net: 0 }), [data]);
  const years = meta ? Array.from({ length: 5 }, (_, i) => meta.payrollMonth.year - 3 + i) : [];

  const notFinished = (end: string) => notice({ tone: 'warn', title: 'الفترة لم تنتهِ بعد',
    body: <>فترة الرواتب هذه تنتهي في <b className="num">{fmtDay(end)}</b>، ولا يمكن إقفالها قبل ذلك حتى لا تُحفظ نتائج غير مكتملة.<br />يمكنك إقفالها ابتداءً من اليوم التالي. وفي الأثناء تستطيع مراجعة التقرير الحالي وتصديره.</> });
  async function close() {
    if (!period) return;
    if (!finished) return notFinished(period.to);
    if (!(await confirm({ title: 'إقفال الفترة؟', body: `تُحفظ نتائج ${MONTHS_AR[(month ?? 1) - 1]} ${year} كلقطة ثابتة لا تتأثر بتغيير الإعدادات لاحقاً.`, confirmText: 'إقفال الفترة' }))) return;
    try { const r = await api('/reports/close', { method: 'POST', body: { year, month } }); toast.success('تم إقفال الفترة', `${r.closed} موظف`); }
    catch (e) { if (e instanceof ApiError && (e.code === 'PERIOD_NOT_FINISHED' || e.code === 'MONTH_NOT_FINISHED')) notFinished(e.data?.periodEnd ?? period.to); else toast.error('تعذر الإقفال', errText(e)); }
  }
  async function csv() { try { await download(`/reports/payroll.csv?year=${year}&month=${month}`, `payroll-${year}-${String(month).padStart(2, '0')}.csv`); toast.success('تم تنزيل الملف'); } catch (e) { toast.error('تعذر التصدير', errText(e)); } }

  return (<>
    <PageHeader title="التقارير والرواتب" sub={period ? <>فترة <span className="num">{fmtDay(period.from)}</span> ← <span className="num">{fmtDay(period.to)}</span> · {period.days} يوماً</> : 'اختر السنة والشهر'}
      right={<><button className="btn" disabled={!data?.length} onClick={csv}>تصدير CSV</button><button className="btn primary" disabled={!data?.length} onClick={close}>إقفال الفترة</button></>} />
    <div className="card"><div className="row" style={{ gap: 14, alignItems: 'flex-end' }}>
      <div style={{ width: 150 }}><label className="lbl">السنة</label><select value={year ?? ''} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
      <div style={{ width: 200 }}><label className="lbl">الشهر</label><select value={month ?? ''} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS_AR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
      {busy && <Spinner />}</div></div>

    {data && data.length > 0 && (<>
      <div className="grid" style={{ marginBottom: 18 }}>
        {[['الموظفون', String(data.length), ''], ['إجمالي الخصومات', sar(totals.ded), 'var(--bad)'], ['إجمالي المكافآت', sar(totals.bonus), 'var(--ok)'], ['صافي الرواتب', sar(totals.net), '']].map(([l, v, c]) => (
          <div key={l} className="card" style={{ margin: 0, padding: 16 }}><div className="muted small">{l}</div><div className="num" style={{ fontSize: 24, fontWeight: 700, color: c || undefined }}>{v}</div></div>))}</div>
      <div className="card scroll" style={{ padding: 8 }}><table><thead><tr><th>الموظف</th>{tiers.map((t) => <th key={t.key}><span className="dot" style={{ background: t.color, marginInlineEnd: 6 }} />{t.label}</th>)}<th>معوَّض</th><th>الخصومات</th><th>المكافأة</th><th>الصافي</th></tr></thead><tbody>
        {data.map((c) => (<tr key={c.userId} className="click" onClick={() => setSel(c)}><td><b>{c.name}</b><div className="muted small">{ROLE_AR[c.role] ?? c.role}</div></td>
          {tiers.map((t) => <td key={t.key} className="num">{c.result.counts[t.key] ?? 0}</td>)}<td className="num">{c.row.redeemedDays}</td>
          <td className="num" style={{ color: 'var(--bad)' }}>{c.row.lateDeductionsMinor + c.row.absentDeductionsMinor ? sar(c.row.lateDeductionsMinor + c.row.absentDeductionsMinor) : '—'}</td>
          <td className="num" style={{ color: 'var(--ok)' }}>{c.row.bonusMinor ? sar(c.row.bonusMinor) : '—'}</td><td className="num"><b>{sar(c.row.netSalaryMinor)}</b></td></tr>))}</tbody></table>
        <div className="muted small" style={{ padding: '10px 12px' }}>اضغط على أي موظف لعرض تقرير الفترة كاملاً يوماً بيوم. الأرقام بالريال.</div></div></>)}
    {data && data.length === 0 && !busy && <div className="card empty">لا يوجد موظفون يُحتسب حضورهم بعد. أضف موظفين من صفحة «الموظفون».</div>}
    {sel && <Detail c={sel} onClose={() => setSel(null)} />}
  </>);
}
