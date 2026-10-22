'use client';
import { AttendancePolicy, DEFAULT_POLICY, validatePolicy } from '@attendance/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import { useMeta, useToast } from '../../components/Providers';
import { PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';
import DevicesTab from './devices';
import WhatsappTab from './whatsapp';
import { sanitize, tierIssue } from './helpers';
import { BonusTab, HoursTab, RedemptionTab, TiersTab } from './tabs';

const TABS = [['hours', 'w.settings.tab.hours'], ['tiers', 'w.settings.tab.tiers'], ['redemption', 'w.settings.tab.redemption'], ['bonus', 'w.settings.tab.bonus'], ['devices', 'w.settings.tab.devices'], ['whatsapp', 'w.settings.tab.whatsapp']] as const;
type TabKey = (typeof TABS)[number][0];

export default function Settings() {
  const { t } = useI18n();
  const toast = useToast(); const { meta } = useMeta();
  const [tab, setTab] = useState<TabKey>('hours');
  const [p, setP] = useState<AttendancePolicy | null>(null); const [orig, setOrig] = useState(''); const [id, setId] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => { const q = new URLSearchParams(window.location.search); const tabParam = q.get('tab') as TabKey | null; if (tabParam && TABS.some(([k]) => k === tabParam)) setTab(tabParam); if (q.get('welcome')) setWelcome(true); }, []);
  const load = useCallback(() => api<any[]>('/policies').then((rows) => { const d = rows.find((r) => r.isDefault) ?? rows[0]; const cfg = sanitize(d?.config ?? DEFAULT_POLICY); setId(d?.id ?? null); setP(cfg); setOrig(JSON.stringify(cfg)); }).catch((e) => toast.error(t('w.settings.loadError'), errText(e, t))), [toast, t]);
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
                   : await api('/policies', { method: 'POST', body: { name: t('w.settings.defaultName'), config: p, effectiveFrom: meta?.today ?? new Date().toISOString().slice(0, 10), isDefault: true } });
      setId(r.id); setOrig(JSON.stringify(p)); toast.success(t('w.settings.saveDone'), t('w.settings.saveDoneBody'));
    } catch (e) { toast.error(t('w.settings.saveError'), errText(e, t)); }
    setBusy(false);
  }

  return (<>
    <PageHeader title={t('w.settings.title')} sub={t('w.settings.sub')} />
    {welcome && <div className="alert ok" style={{ marginBottom: 18 }}><span>✓</span><span>{t('w.settings.welcome')}</span></div>}
    <div className="tabs" role="tablist">{TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t(label)}</button>)}</div>
    {!p ? <div className="empty"><Spinner /></div> : (<>
      {tab === 'hours' && <HoursTab p={p} edit={edit} />}
      {tab === 'tiers' && <TiersTab p={p} edit={edit} />}
      {tab === 'redemption' && <RedemptionTab p={p} edit={edit} />}
      {tab === 'bonus' && <BonusTab p={p} edit={edit} />}
      {tab === 'devices' && <DevicesTab />}
      {tab === 'whatsapp' && <WhatsappTab />}
      {tab !== 'devices' && tab !== 'whatsapp' && (dirty || errors.length > 0) && (
        <div className="savebar"><span>{errors.length ? t('w.settings.problems', { count: tierProblems || errors.length }) : t('w.settings.unsaved')}</span>
          <span className="row"><button className="btn" disabled={busy} onClick={() => { setP(JSON.parse(orig)); }}>{t('w.settings.revert')}</button>
            <button className="btn go" disabled={busy || errors.length > 0} onClick={save}>{busy ? <Spinner /> : t('w.settings.save')}</button></span></div>)}
    </>)}
  </>);
}
