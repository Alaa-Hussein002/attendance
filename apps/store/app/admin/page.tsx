'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@attendance/i18n/react';

export default function Admin() {
  const { t } = useI18n();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    fetch('/api/admin/stats').then((r) => setAuthed(r.ok)).catch(() => setAuthed(false));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) { setAuthed(true); } else { setErr('Invalid password'); }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
  }

  if (authed === null) return <div className="container section">{t('store.common.loading')}</div>;
  if (!authed) {
    return (
      <div className="container section" style={{ maxWidth: 400 }}>
        <h1>{t('store.admin.login')}</h1>
        <form className="form" onSubmit={login}>
          <label>{t('store.admin.password')}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="btn primary">{t('store.admin.signin')}</button>
          {err && <div className="alert">{err}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{t('store.admin.title')}</h1>
        <button className="btn ghost" onClick={logout}>{t('store.admin.signout')}</button>
      </div>
      <div className="row" style={{ marginBottom: 20 }}>
        {['dashboard', 'customers', 'orders', 'licenses', 'releases', 'issue'].map((x) => (
          <button key={x} className={tab === x ? 'btn primary' : 'btn ghost'} style={{ padding: '6px 14px' }} onClick={() => setTab(x)}>{t(`store.admin.${x}` as any)}</button>
        ))}
      </div>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'customers' && <Customers />}
      {tab === 'orders' && <Orders />}
      {tab === 'licenses' && <Licenses />}
      {tab === 'releases' && <Releases />}
      {tab === 'issue' && <Issue />}
    </div>
  );
}

function Dashboard() {
  const { t } = useI18n();
  const [s, setS] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/stats').then((r) => r.json()).then(setS); }, []);
  if (!s) return <p>{t('store.common.loading')}</p>;
  return (
    <div className="grid grid-3">
      <div className="card"><div className="price">{s.customers}</div><p>{t('store.admin.totalCustomers')}</p></div>
      <div className="card"><div className="price">{s.orders}</div><p>{t('store.admin.totalOrders')}</p></div>
      <div className="card"><div className="price">{s.paidOrders}</div><p>{t('store.admin.paidOrders')}</p></div>
      <div className="card"><div className="price">{s.licenses}</div><p>{t('store.admin.activeLicenses')}</p></div>
    </div>
  );
}

function Customers() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetch('/api/admin/customers').then((r) => r.json()).then(setRows); }, []);
  return (
    <table className="table"><thead><tr><th>{t('store.admin.customerEmail')}</th><th>{t('store.admin.customerName')}</th><th>{t('store.admin.customerCompany')}</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.email}</td><td>{r.name}</td><td>{r.company}</td></tr>)}</tbody></table>
  );
}

function Orders() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetch('/api/admin/orders').then((r) => r.json()).then(setRows); }, []);
  return (
    <table className="table"><thead><tr><th>{t('store.admin.orderNumber')}</th><th>{t('store.admin.customerEmail')}</th><th>{t('store.admin.orderStatus')}</th><th>{t('store.admin.orderAmount')}</th><th>{t('store.admin.orderPaidAt')}</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.number}</td><td>{r.customer?.email}</td><td>{r.status}</td><td>{(r.amount / 100).toFixed(2)}</td><td>{r.paidAt ? new Date(r.paidAt).toLocaleString() : '—'}</td></tr>)}</tbody></table>
  );
}

function Licenses() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetch('/api/admin/licenses').then((r) => r.json()).then(setRows); }, []);
  async function revoke(serial: string) {
    await fetch('/api/admin/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial }) });
    setRows((r) => r.map((x) => x.serial === serial ? { ...x, revokedAt: new Date().toISOString() } : x));
  }
  return (
    <table className="table"><thead><tr><th>{t('store.admin.licenseSerial')}</th><th>{t('store.admin.customerEmail')}</th><th>{t('store.admin.licensePlan')}</th><th>{t('store.admin.licenseValidUntil')}</th><th></th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td><code className="mono">{r.serial}</code></td><td>{r.customer?.email}</td><td>{r.planCode}</td><td>{r.validUntil}</td><td>{!r.revokedAt && <button className="btn ghost" style={{ padding: '4px 10px' }} onClick={() => revoke(r.serial)}>{t('store.admin.revoke')}</button>}{r.revokedAt && <span style={{ color: 'var(--danger)' }}>{t('store.admin.licenseRevoked')}</span>}</td></tr>)}</tbody></table>
  );
}

function Releases() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ version: '', fileName: '', sizeBytes: '', sha256: '', notes: '' });
  useEffect(() => { fetch('/api/admin/releases').then((r) => r.json()).then(setRows); }, []);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/admin/releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm({ version: '', fileName: '', sizeBytes: '', sha256: '', notes: '' });
    fetch('/api/admin/releases').then((r) => r.json()).then(setRows);
  }
  return (
    <div>
      <form className="form" onSubmit={add} style={{ marginBottom: 24 }}>
        <label>{t('store.admin.releaseVersion')}<input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></label>
        <label>{t('store.admin.releaseFile')}<input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} /></label>
        <label>{t('store.admin.releaseSize')}<input value={form.sizeBytes} onChange={(e) => setForm({ ...form, sizeBytes: e.target.value })} /></label>
        <label>{t('store.admin.releaseSha')}<input value={form.sha256} onChange={(e) => setForm({ ...form, sha256: e.target.value })} /></label>
        <label>{t('store.admin.releaseNotes')}<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <button className="btn primary">{t('store.admin.releaseAdd')}</button>
      </form>
      <table className="table"><thead><tr><th>{t('store.admin.releaseVersion')}</th><th>{t('store.admin.releaseFile')}</th><th>{t('store.admin.releaseSize')}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{r.version}</td><td>{r.fileName}</td><td>{r.sizeBytes}</td></tr>)}</tbody></table>
    </div>
  );
}

function Issue() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('BUSINESS');
  const [days, setDays] = useState('365');
  const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, planCode: plan, days: Number(days) }) });
    const d = await res.json();
    setMsg(res.ok ? `${t('store.admin.issueDone')} — ${d.serial}` : (d.error || 'error'));
  }
  return (
    <form className="form" onSubmit={submit}>
      <label>{t('store.admin.issueCustomer')}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>{t('store.admin.issuePlan')}
        <select value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="STARTER">STARTER</option>
          <option value="BUSINESS">BUSINESS</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </select>
      </label>
      <label>{t('store.admin.issueDays')}<input type="number" value={days} onChange={(e) => setDays(e.target.value)} /></label>
      <button className="btn primary">{t('store.admin.issueSerial')}</button>
      {msg && <div className="alert ok">{msg}</div>}
    </form>
  );
}
