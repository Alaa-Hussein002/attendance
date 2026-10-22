'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import { useToast } from '../../components/Providers';
import { Field, PageHeader, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';

const MapPicker = dynamic(() => import('../../components/MapPicker'), { ssr: false, loading: () => <div className="map" /> });
const MODES: { key: string; label: string; desc: string }[] = [
  { key: 'GPS', label: 'w.branches.mode.GPS', desc: 'w.branches.mode.GPS.desc' },
  { key: 'NETWORK', label: 'w.branches.mode.NETWORK', desc: 'w.branches.mode.NETWORK.desc' },
  { key: 'FINGERPRINT', label: 'w.branches.mode.FINGERPRINT', desc: 'w.branches.mode.FINGERPRINT.desc' },
];
const blank = { id: '', name: '', loc: null as null | { lat: number; lng: number }, radius: 150, ranges: '', modes: ['GPS'] as string[] };

export default function Branches() {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]); const [f, setF] = useState(blank); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<any[]>('/branches').then(setRows).catch((e) => toast.error(t('w.branches.loadError'), errText(e, t))), [toast, t]);
  useEffect(() => { load(); }, [load]);
  const edit = (b: any) => { setF({ id: b.id, name: b.name, loc: b.latitude != null ? { lat: Number(b.latitude), lng: Number(b.longitude) } : null, radius: b.radiusMeters ?? 150, ranges: (b.allowedIpRanges ?? []).join('\n'), modes: b.verificationModes }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const needLoc = f.modes.includes('GPS') && !f.loc;
  async function save() {
    setBusy(true);
    try {
      await api(f.id ? `/branches/${f.id}` : '/branches', { method: f.id ? 'PUT' : 'POST', body: { name: f.name, latitude: f.loc?.lat, longitude: f.loc?.lng, radiusMeters: f.loc ? f.radius : undefined, allowedIpRanges: f.ranges.split(/[\s,]+/).filter(Boolean), verificationModes: f.modes } });
      toast.success(f.id ? t('w.branches.updated') : t('w.branches.added')); setF(blank); setOpen(false); load();
    } catch (e) { toast.error(t('w.branches.saveError'), errText(e, t)); }
    setBusy(false);
  }
  return (<>
    <PageHeader title={t('w.branches.title')} sub={t('w.branches.sub')} right={!open && <button className="btn primary" onClick={() => { setF(blank); setOpen(true); }}>+ {t('w.branches.new')}</button>} />
    {open && (<div className="card"><h2>{f.id ? t('w.branches.editTitle') : t('w.branches.newTitle')}</h2>
      <div className="stack" style={{ marginTop: 14 }}>
        <Field label={t('w.branches.name')}><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('w.branches.namePh')} /></Field>
        <div><div className="lbl">{t('w.branches.methods')}</div><div className="stack">{MODES.map((m) => (
          <div key={m.key} className="row" style={{ padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 14 }}><Switch checked={f.modes.includes(m.key)} onChange={(v) => setF({ ...f, modes: v ? [...f.modes, m.key] : f.modes.filter((x) => x !== m.key) })} /><div><b>{t(m.label)}</b><div className="muted small">{t(m.desc)}</div></div></div>))}</div></div>
        {f.modes.includes('GPS') && (<div><div className="lbl">{t('w.branches.location')}</div><MapPicker value={f.loc} radius={f.radius} onChange={(loc) => setF((s) => ({ ...s, loc }))} />
          <div className="grid" style={{ marginTop: 14 }}><Field label={t('w.branches.radius', { m: f.radius })}><input type="range" min={30} max={1000} step={10} value={f.radius} onChange={(e) => setF({ ...f, radius: Number(e.target.value) })} style={{ padding: 0 }} /></Field></div>
          {needLoc && <div className="alert warn">{t('w.branches.needLocation')}</div>}</div>)}
        {f.modes.includes('NETWORK') && <Field label={t('w.branches.ranges')} help={t('w.branches.rangesHelp')}><textarea rows={3} dir="ltr" value={f.ranges} onChange={(e) => setF({ ...f, ranges: e.target.value })} /></Field>}
        <div className="row"><button className="btn primary" disabled={busy || !f.name.trim() || !f.modes.length || needLoc} onClick={save}>{f.id ? t('w.branches.save') : t('w.branches.add')}</button><button className="btn" onClick={() => { setOpen(false); setF(blank); }}>{t('w.branches.cancel')}</button></div>
      </div></div>)}
    <div className="card scroll">{!rows.length ? <div className="empty">{t('w.branches.empty')}</div> : (
      <table><thead><tr><th>{t('w.branches.col.branch')}</th><th>{t('w.branches.col.methods')}</th><th>{t('w.branches.col.location')}</th><th /></tr></thead><tbody>{rows.map((b) => (
        <tr key={b.id}><td><b>{b.name}</b></td><td><div className="row" style={{ gap: 6 }}>{b.verificationModes.map((m: string) => <span key={m} className="badge">{MODES.find((x) => x.key === m) ? t(MODES.find((x) => x.key === m)!.label) : m}</span>)}</div></td>
          <td>{b.latitude != null ? <span className="badge">{t('w.branches.located', { m: b.radiusMeters })}</span> : <span className="muted">—</span>}</td><td style={{ textAlign: 'end' }}><button className="btn sm" onClick={() => edit(b)}>{t('w.branches.edit')}</button></td></tr>))}</tbody></table>)}</div>
  </>);
}
