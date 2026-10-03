'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const MODES: [string, string][] = [['GPS', 'الموقع (GPS)'], ['NETWORK', 'شبكة المكتب'], ['FINGERPRINT', 'جهاز البصمة']];
const empty = { id: '', name: '', latitude: '', longitude: '', radiusMeters: '150', ranges: '', modes: ['GPS'] as string[] };

export default function Branches() {
  const [rows, setRows] = useState<any[]>([]); const [f, setF] = useState(empty); const [err, setErr] = useState('');
  const load = () => api<any[]>('/branches').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  async function save() {
    setErr('');
    const body = { name: f.name, latitude: num(f.latitude), longitude: num(f.longitude), radiusMeters: num(f.radiusMeters),
      allowedIpRanges: f.ranges.split(/[\s,]+/).filter(Boolean), verificationModes: f.modes };
    try { await api(f.id ? `/branches/${f.id}` : '/branches', { method: f.id ? 'PUT' : 'POST', body }); setF(empty); load(); }
    catch (e: any) { setErr(e.message); }
  }
  const edit = (b: any) => setF({ id: b.id, name: b.name, latitude: b.latitude ?? '', longitude: b.longitude ?? '', radiusMeters: String(b.radiusMeters ?? ''),
    ranges: (b.allowedIpRanges ?? []).join(', '), modes: b.verificationModes });
  const inp = (k: 'name' | 'latitude' | 'longitude' | 'radiusMeters' | 'ranges', label: string) =>
    <div><label>{label}</label><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;

  return (<>
    <h1>الفروع</h1>{err && <div className="errors">{err}</div>}
    <div className="card"><h2>{f.id ? 'تعديل فرع' : 'فرع جديد'}</h2>
      <div className="row">{inp('name', 'الاسم')}{inp('latitude', 'خط العرض')}{inp('longitude', 'خط الطول')}{inp('radiusMeters', 'نصف القطر (متر)')}</div>
      <div className="row">{inp('ranges', 'نطاقات شبكة المكتب (مثل 203.0.113.0/24، مفصولة بفاصلة)')}</div>
      <label>طرق التحقق المفعّلة</label>
      <div className="days">{MODES.map(([k, t]) => <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'inherit' }}>
        <input type="checkbox" checked={f.modes.includes(k)} onChange={(e) => setF({ ...f, modes: e.target.checked ? [...f.modes, k] : f.modes.filter((m) => m !== k) })} />{t}</label>)}</div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}><button className="primary" onClick={save}>حفظ</button>{f.id && <button onClick={() => setF(empty)}>إلغاء</button>}</div>
    </div>
    <div className="card scroll"><table><thead><tr><th>الفرع</th><th>طرق التحقق</th><th>الموقع</th><th /></tr></thead><tbody>
      {rows.map((b) => <tr key={b.id}><td>{b.name}</td><td>{b.verificationModes.join('، ')}</td><td className="num">{b.latitude ? `${b.latitude}, ${b.longitude} (${b.radiusMeters}م)` : '—'}</td><td><button onClick={() => edit(b)}>تعديل</button></td></tr>)}
    </tbody></table></div></>);
}
