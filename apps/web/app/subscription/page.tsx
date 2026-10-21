'use client';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../components/Providers';
import { PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import { fmtDay } from '../../lib/format';

const STATE: Record<string, [string, string]> = { TRIAL: ['تجريبية', '#e4eefc'], ACTIVE: ['فعّال', '#e4f5ea'], EXPIRING: ['يوشك على الانتهاء', '#fff1d6'], GRACE: ['مهلة سماح', '#fdebe4'], RESTRICTED: ['منتهٍ — قراءة فقط', '#f6d9d4'] };
const FEATURES: [string, string][] = [['tasks', 'المهام والحجوزات'], ['fingerprint', 'أجهزة البصمة'], ['whatsapp', 'إشعارات واتساب']];
const Bar = ({ used, max }: { used: number; max: number }) => { const p = Math.min(100, max ? (used / max) * 100 : 0); return (<div style={{ height: 10, background: 'var(--soft)', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${p}%`, height: '100%', background: p >= 100 ? 'var(--bad)' : p >= 85 ? '#f0b429' : 'var(--ok)' }} /></div>); };

export default function Subscription() {
  const toast = useToast();
  const [s, setS] = useState<any>(null); const [key, setKey] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(() => api('/license').then(setS).catch((e) => toast.error('تعذر التحميل', errText(e))), [toast]);
  useEffect(() => { load(); }, [load]);
  if (!s) return <div className="empty"><Spinner /></div>;
  const [stLabel, stBg] = STATE[s.state];

  async function activate() {
    setBusy(true);
    try { const r = await api('/license/activate', { method: 'POST', body: { key } }); setS({ ...s, ...r }); setKey(''); toast.success('تم تفعيل الاشتراك', `${r.planName} · حتى ${r.validUntil}`); }
    catch (e) { toast.error('تعذر التفعيل', errText(e)); }
    setBusy(false);
  }
  return (<>
    <PageHeader title="الاشتراك" sub="باقتك الحالية وحدودها وتاريخ انتهائها." />
    {s.keyProblem && <div className="alert err" style={{ marginBottom: 14 }}>المفتاح المحفوظ غير مقبول ({s.keyProblem === 'WRONG_INSTALLATION' ? 'صادر لتثبيت آخر' : s.keyProblem === 'NO_PUBLIC_KEY' ? 'لم يُضبط LICENSE_PUBLIC_KEY في الخادم' : 'توقيع غير صحيح'}). يعمل النظام بوضع التجربة.</div>}
    {s.clockRolledBack && <div className="alert warn" style={{ marginBottom: 14 }}>ساعة الخادم متأخرة عن آخر وقت سُجّل. صحّح تاريخ الجهاز؛ الاشتراك يُحسب على أحدث وقت معروف.</div>}
    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><div><div className="muted small">الباقة</div><div style={{ fontSize: 26, fontWeight: 700 }}>{s.planName}</div>{s.customer && <div className="muted">{s.customer}</div>}</div>
      <div style={{ textAlign: 'end' }}><span className="badge" style={{ background: stBg, fontSize: 14, padding: '6px 14px' }}>{stLabel}</span>
        <div className="muted small" style={{ marginTop: 8 }}>{s.validUntil ? <>{s.state === 'TRIAL' ? 'تنتهي التجربة' : 'ينتهي'} <b className="num">{fmtDay(s.validUntil)}</b></> : ''}</div>
        <div className="num" style={{ fontWeight: 700 }}>{s.daysLeft >= 0 ? `متبقٍّ ${s.daysLeft} يوماً` : s.graceLeft ? `مهلة السماح: ${s.graceLeft} يوماً` : 'منتهٍ'}</div></div></div></div>

    <div className="grid"><div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><b>الموظفون</b><span className="num">{s.usage.employees} / {s.limits.employees}</span></div><Bar used={s.usage.employees} max={s.limits.employees} /></div>
      <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><b>الفروع</b><span className="num">{s.usage.branches} / {s.limits.branches}</span></div><Bar used={s.usage.branches} max={s.limits.branches} /></div></div>

    <div className="card"><h2>الميزات المشمولة</h2><div className="row" style={{ gap: 10, marginTop: 10 }}>{FEATURES.map(([k, l]) => <span key={k} className="badge" style={{ background: s.features[k] ? '#e4f5ea' : 'var(--soft)', opacity: s.features[k] ? 1 : .6, padding: '6px 14px' }}>{s.features[k] ? '✓' : '✕'} {l}</span>)}</div></div>

    <div className="card"><h2>تفعيل أو تجديد الاشتراك</h2><p className="sub">بعد الدفع تصلك سلسلة مفتاح. الصقها هنا ويُفعَّل الاشتراك فوراً.</p>
      <div className="alert" style={{ marginBottom: 12 }}><span>معرّف هذا التثبيت (أرسله عند الشراء):</span><b className="num" style={{ userSelect: 'all' }} dir="ltr">{s.installationId}</b>
        <button className="btn sm" style={{ marginInlineStart: 'auto' }} onClick={() => { navigator.clipboard?.writeText(s.installationId); toast.success('تم النسخ'); }}>نسخ</button></div>
      <textarea rows={3} dir="ltr" placeholder="BMK1.xxxxx.yyyyy" value={key} onChange={(e) => setKey(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} />
      <button className="btn primary" style={{ marginTop: 12 }} disabled={busy || !key.trim()} onClick={activate}>{busy ? <Spinner /> : 'تفعيل المفتاح'}</button></div>

    <div className="card scroll"><h2>الباقات</h2><table style={{ marginTop: 8 }}><thead><tr><th>الباقة</th><th>الموظفون</th><th>الفروع</th><th>المهام</th><th>البصمة</th><th>واتساب</th></tr></thead><tbody>
      {Object.entries(s.plans).filter(([k]) => k !== 'TRIAL').map(([k, p]: any) => (<tr key={k} style={{ background: s.plan === k ? '#faf9f6' : undefined }}><td><b>{p.name}</b>{s.plan === k && <span className="badge" style={{ marginInlineStart: 8 }}>باقتك</span>}</td><td className="num">{p.employees}</td><td className="num">{p.branches}</td>
        {(['tasks', 'fingerprint', 'whatsapp'] as const).map((f) => <td key={f}>{p.features[f] ? '✓' : '—'}</td>)}</tr>))}</tbody></table></div>
  </>);
}
