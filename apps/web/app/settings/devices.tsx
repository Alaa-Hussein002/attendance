'use client';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';
import { useDialog, useToast } from '../../components/Providers';
import { Field, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';

const blank = { id: '', branchId: '', name: '', brand: 'ZKTECO', model: '', host: '', port: '4370', serialNumber: '', notes: '', active: true };
const Stat = ({ v, l, c }: { v: number | string; l: string; c?: string }) => <div style={{ background: 'var(--soft)', borderRadius: 14, padding: '10px 14px', minWidth: 96 }}><div className="num" style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div><div className="muted small">{l}</div></div>;

export default function DevicesTab() {
  const { t } = useI18n();
  const toast = useToast(); const { confirm } = useDialog();
  const [rows, setRows] = useState<any[]>([]); const [branches, setBranches] = useState<any[]>([]); const [emps, setEmps] = useState<any[]>([]); const [unm, setUnm] = useState<any[]>([]);
  const [f, setF] = useState(blank); const [busy, setBusy] = useState(false); const [key, setKey] = useState<{ name: string; value: string } | null>(null); const [open, setOpen] = useState(false);
  const ago = (iso?: string | null) => {
    if (!iso) return t('w.devices.never');
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    return s < 90 ? t('w.devices.now') : s < 3600 ? t('w.devices.minAgo', { n: Math.round(s / 60) }) : s < 86400 ? t('w.devices.hourAgo', { n: Math.round(s / 3600) }) : t('w.devices.dayAgo', { n: Math.round(s / 86400) });
  };
  const load = useCallback(() => Promise.all([api<any[]>('/biometric-devices'), api<any[]>('/branches'), api<any[]>('/employees'), api<any[]>('/biometric-devices/unmapped')])
    .then(([d, b, e, u]) => { setRows(d); setBranches(b); setEmps(e.filter((x) => x.active && x.tracksAttendance)); setUnm(u); }).catch((e) => toast.error(t('w.devices.loadError'), errText(e, t))), [toast, t]);
  useEffect(() => { load(); const timer = setInterval(load, 20000); return () => clearInterval(timer); }, [load]);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try { const r = await api(f.id ? `/biometric-devices/${f.id}` : '/biometric-devices', { method: f.id ? 'PUT' : 'POST', body: { ...f, port: Number(f.port) } });
      toast.success(f.id ? t('w.devices.updated') : t('w.devices.added')); if (r.apiKey) setKey({ name: f.name, value: r.apiKey }); setF(blank); setOpen(false); load(); }
    catch (e) { toast.error(t('w.devices.saveError'), errText(e, t)); }
    setBusy(false);
  }
  const rotate = async (d: any) => { if (!(await confirm({ title: t('w.devices.rotateTitle'), body: t('w.devices.rotateBody'), confirmText: t('w.devices.rotateConfirm'), danger: true }))) return; try { const r = await api(`/biometric-devices/${d.id}/key`, { method: 'POST' }); setKey({ name: d.name, value: r.apiKey }); } catch (e) { toast.error(t('w.devices.actionError'), errText(e, t)); } };
  const mapId = async (u: any, userId: string) => {
    if (!userId) return;
    try { await api(`/employees/${userId}`, { method: 'PUT', body: { biometricId: u.biometricId } }); const r = await api('/biometric-devices/reprocess', { method: 'POST' }); toast.success(t('w.devices.linked'), r.applied ? t('w.devices.linkedApplied', { count: r.applied }) : ''); load(); } catch (e) { toast.error(t('w.devices.linkError'), errText(e, t)); }
  };

  return (<>
    {key && (<div className="overlay"><div className="modal"><h3>{t('w.devices.keyTitle', { name: key.name })}</h3>
      <p className="muted">{t('w.devices.keyBody')}</p>
      <input readOnly dir="ltr" value={key.value} onFocus={(e) => e.target.select()} style={{ fontFamily: 'monospace', fontSize: 13 }} />
      <div className="actions"><button className="btn primary" onClick={() => { navigator.clipboard?.writeText(key.value); toast.success(t('w.devices.copied')); }}>{t('w.devices.copyKey')}</button><button className="btn" onClick={() => setKey(null)}>{t('w.devices.done')}</button></div></div></div>)}

    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}><div><h2 style={{ fontSize: 18 }}>{t('w.devices.title')}</h2><div className="muted small">{t('w.devices.sub')}</div></div>
      {!open && <button className="btn primary" onClick={() => { setF(blank); setOpen(true); }}>+ {t('w.devices.new')}</button>}</div>

    {open && (<div className="card"><h2>{f.id ? t('w.devices.editTitle') : t('w.devices.newTitle')}</h2>
      <div className="grid" style={{ marginTop: 12 }}>
        <Field label={t('w.devices.branch')}><select value={f.branchId} onChange={set('branchId')}><option value="">{t('w.devices.choose')}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label={t('w.devices.name')}><input value={f.name} onChange={set('name')} placeholder={t('w.devices.namePh')} /></Field>
        <Field label={t('w.devices.model')}><input value={f.model} onChange={set('model')} dir="ltr" placeholder="iClock / SpeedFace / MB460" /></Field>
        <Field label={t('w.devices.host')}><input value={f.host} onChange={set('host')} dir="ltr" placeholder="192.168.1.201" /></Field>
        <Field label={t('w.devices.port')}><input type="number" value={f.port} onChange={set('port')} /></Field>
        <Field label={t('w.devices.serial')}><input value={f.serialNumber} onChange={set('serialNumber')} dir="ltr" /></Field>
        <Field label={t('w.devices.notes')}><input value={f.notes} onChange={set('notes')} /></Field></div>
      {f.id && <div style={{ marginTop: 12 }}><Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label={t('w.devices.active')} /></div>}
      <div className="row" style={{ marginTop: 16 }}><button className="btn primary" disabled={busy || !f.branchId || !f.name.trim() || !f.host.trim()} onClick={save}>{f.id ? t('w.devices.save') : t('w.devices.add')}</button><button className="btn" onClick={() => { setOpen(false); setF(blank); }}>{t('w.devices.cancel')}</button></div></div>)}

    {!rows.length && !open && <div className="card empty">{t('w.devices.empty')}</div>}
    {rows.map((d) => (<div className="card" key={d.id}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><div className="row"><span className="dot" style={{ background: d.online ? 'var(--ok)' : '#b9b6ad', width: 12, height: 12 }} /><b style={{ fontSize: 17 }}>{d.name}</b><span className="badge">{d.online ? t('w.devices.online') : d.active ? t('w.devices.offline') : t('w.devices.stopped')}</span></div>
          <div className="muted small" style={{ marginTop: 4 }}>{branches.find((b) => b.id === d.branchId)?.name} · <span className="num">{d.host}:{d.port}</span> · {d.brand} {d.model}</div></div>
        <div className="row" style={{ gap: 6 }}><button className="btn sm" onClick={() => { setF({ id: d.id, branchId: d.branchId, name: d.name, brand: d.brand, model: d.model ?? '', host: d.host, port: String(d.port), serialNumber: d.serialNumber ?? '', notes: d.notes ?? '', active: d.active }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{t('common.edit')}</button>
          <button className="btn sm" onClick={() => rotate(d)}>{t('w.devices.rotate')}</button>
          <button className="btn sm danger" onClick={async () => { if (await confirm({ title: t('w.devices.deleteTitle'), body: t('w.devices.deleteBody', { name: d.name }), confirmText: t('common.delete'), danger: true })) { try { await api(`/biometric-devices/${d.id}`, { method: 'DELETE' }); toast.success(t('w.devices.deleted')); load(); } catch (e) { toast.error(t('w.devices.deleteError'), errText(e, t)); } } }}>{t('common.delete')}</button></div></div>
      <div className="row" style={{ marginTop: 14, gap: 10 }}>
        <Stat v={d.today.total} l={t('w.devices.todayPunches')} /><Stat v={d.today.recorded} l={t('w.devices.recorded')} c="var(--ok)" /><Stat v={d.today.duplicate} l={t('w.devices.duplicate')} /><Stat v={d.today.unmapped} l={t('w.devices.unmapped')} c={d.today.unmapped ? 'var(--bad)' : undefined} /><Stat v={d.totalPunches} l={t('w.devices.totalPunches')} />
        <div style={{ marginInlineStart: 'auto' }} className="small muted"><div>{t('w.devices.lastSeen', { ago: ago(d.lastSeenAt) })}</div><div>{t('w.devices.lastSync', { ago: ago(d.lastSyncAt) })}</div>
          {d.clockOffsetMs != null && <div style={{ color: Math.abs(d.clockOffsetMs) > 300000 ? 'var(--bad)' : undefined }}>{t('w.devices.clock', { value: Math.abs(d.clockOffsetMs) < 60000 ? t('w.devices.clockOk') : t('w.devices.clockDiff', { n: Math.round(d.clockOffsetMs / 60000) }) })}</div>}</div></div>
      {!d.hasKey && <div className="alert warn" style={{ marginTop: 12 }}>{t('w.devices.noKey')}</div>}
    </div>))}

    {unm.length > 0 && (<div className="card"><h2>{t('w.devices.unmappedTitle')} <span className="badge" style={{ background: '#fdebe4' }}>{unm.length}</span></h2><p className="sub">{t('w.devices.unmappedSub')}</p>
      <table><thead><tr><th>{t('w.devices.biometricId')}</th><th>{t('w.devices.device')}</th><th>{t('w.devices.punches')}</th><th>{t('w.devices.link')}</th></tr></thead><tbody>{unm.map((u) => (
        <tr key={u.deviceId + u.biometricId}><td className="num"><b>{u.biometricId}</b></td><td>{u.deviceName}</td><td className="num">{u.punches}</td>
          <td><select defaultValue="" onChange={(e) => mapId(u, e.target.value)}><option value="">{t('w.leaves.pickEmployee')}</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}{e.biometricId ? t('w.devices.linkCurrent', { id: e.biometricId }) : ''}</option>)}</select></td></tr>))}</tbody></table></div>)}

    <div className="card"><h2>{t('w.devices.agentTitle')}</h2><p className="sub">{t('w.devices.agentSub')}</p>
      <ol style={{ lineHeight: 2, margin: 0, paddingInlineStart: 22 }}><li>{t('w.devices.agentStep1')}</li><li>{t('w.devices.agentStep2')}</li><li>{t('w.devices.agentStep3')}</li><li>{t('w.devices.agentStep4')}</li></ol></div>
  </>);
}
