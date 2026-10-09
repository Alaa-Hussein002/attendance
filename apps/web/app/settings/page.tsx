'use client';
import { AttendancePolicy, DEFAULT_POLICY, validatePolicy } from '@attendance/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeta, useToast } from '../../components/Providers';
import { PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import DevicesTab from './devices';
import WhatsappTab from './whatsapp';
import { sanitize, tierIssue } from './helpers';
import { BonusTab, HoursTab, RedemptionTab, TiersTab } from './tabs';

const TABS = [['hours', 'الدوام والعطل'], ['tiers', 'مراحل الحضور'], ['redemption', 'التعويض'], ['bonus', 'المكافآت'], ['devices', 'أجهزة البصمة'], ['whatsapp', 'واتساب']] as const;
type TabKey = (typeof TABS)[number][0];

export default function Settings() {
  const toast = useToast(); const { meta } = useMeta();
  const [tab, setTab] = useState<TabKey>('hours');
  const [p, setP] = useState<AttendancePolicy | null>(null); const [orig, setOrig] = useState(''); const [id, setId] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => { const q = new URLSearchParams(window.location.search); const t = q.get('tab') as TabKey | null; if (t && TABS.some(([k]) => k === t)) setTab(t); if (q.get('welcome')) setWelcome(true); }, []);
  const load = useCallback(() => api<any[]>('/policies').then((rows) => { const d = rows.find((r) => r.isDefault) ?? rows[0]; const cfg = sanitize(d?.config ?? DEFAULT_POLICY); setId(d?.id ?? null); setP(cfg); setOrig(JSON.stringify(cfg)); }).catch((e) => toast.error('تعذر تحميل الإعدادات', errText(e))), [toast]);
  useEffect(() => { load(); }, [load]);

  const edit = useCallback((fn: (x: AttendancePolicy) => void) => setP((old) => { if (!old) return old; const n = structuredClone(old); fn(n); return sanitize(n); }), []);
  const dirty = !!p && JSON.stringify(p) !== orig;
  const errors = useMemo(() => (p ? validatePolicy(p) : []), [p]);
  const tierProblems = useMemo(() => (p ? p.tiers.map((_, i) => tierIssue(p, i)).filter(Boolean).length : 0), [p]);

  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);

  async function save() {
    if (!p) return; setBusy(true);
    try {
      const r = id ? await api(`/policies/${id}`, { method: 'PUT', body: { config: p, effectiveFrom: meta?.today ?? new Date().toISOString().slice(0, 10) } })
                   : await api('/policies', { method: 'POST', body: { name: 'السياسة الافتراضية', config: p, effectiveFrom: meta?.today ?? new Date().toISOString().slice(0, 10), isDefault: true } });
      setId(r.id); setOrig(JSON.stringify(p)); toast.success('تم حفظ الإعدادات', 'تُطبَّق على حساب الحضور والرواتب فوراً');
    } catch (e) { toast.error('تعذر الحفظ', errText(e)); }
    setBusy(false);
  }

  return (<>
    <PageHeader title="الإعدادات" sub="كل قواعد الحضور والخصم والمكافآت تُدار من هنا، ولا حاجة لتعديل أي كود." />
    {welcome && <div className="alert ok" style={{ marginBottom: 18 }}><span>✓</span><span>تم إنشاء حسابك. ابدأ بضبط الدوام ومراحل الحضور، ثم أضف الفروع والموظفين من القائمة.</span></div>}
    <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
    {!p ? <div className="empty"><Spinner /></div> : (<>
      {tab === 'hours' && <HoursTab p={p} edit={edit} />}
      {tab === 'tiers' && <TiersTab p={p} edit={edit} />}
      {tab === 'redemption' && <RedemptionTab p={p} edit={edit} />}
      {tab === 'bonus' && <BonusTab p={p} edit={edit} />}
      {tab === 'devices' && <DevicesTab />}
      {tab === 'whatsapp' && <WhatsappTab />}
      {tab !== 'devices' && tab !== 'whatsapp' && (dirty || errors.length > 0) && (
        <div className="savebar"><span>{errors.length ? `يوجد ${tierProblems || errors.length} ${tierProblems ? 'مشكلة في المراحل' : 'خطأ'} يجب إصلاحه قبل الحفظ` : 'لديك تغييرات غير محفوظة'}</span>
          <span className="row"><button className="btn" disabled={busy} onClick={() => { setP(JSON.parse(orig)); }}>تراجع</button>
            <button className="btn go" disabled={busy || errors.length > 0} onClick={save}>{busy ? <Spinner /> : 'حفظ التغييرات'}</button></span></div>)}
    </>)}
  </>);
}
