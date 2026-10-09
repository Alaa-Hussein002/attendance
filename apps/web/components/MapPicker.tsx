'use client';
import { useEffect, useRef, useState } from 'react';
import { Spinner } from './ui';

export interface LatLng { lat: number; lng: number }
const DEFAULT: LatLng = { lat: 21.5433, lng: 39.1728 };

/** Pick a branch location by clicking the map (OpenStreetMap). No coordinates are ever typed. */
export default function MapPicker({ value, radius, onChange, onPlace }: { value: LatLng | null; radius: number; onChange: (p: LatLng) => void; onPlace?: (name: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<{ L: any; map: any; marker: any; circle: any } | null>(null);
  const cb = useRef(onChange); cb.current = onChange;
  const [q, setQ] = useState(''); const [found, setFound] = useState<any[]>([]); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import('leaflet')).default; if (dead || !el.current) return;
      const c = value ?? DEFAULT;
      const map = L.map(el.current, { zoomControl: true }).setView([c.lat, c.lng], value ? 17 : 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      const icon = L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17], html: '<div style="width:34px;height:34px;border-radius:50%;background:#111;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:grid;place-items:center"><div style="width:10px;height:10px;border-radius:3px;background:#E65A2E"></div></div>' });
      const marker = L.marker([c.lat, c.lng], { icon, draggable: true, opacity: value ? 1 : 0 }).addTo(map);
      const circle = L.circle([c.lat, c.lng], { radius, color: '#E65A2E', weight: 2, fillColor: '#E65A2E', fillOpacity: .12, opacity: value ? 1 : 0 }).addTo(map);
      const set = (ll: { lat: number; lng: number }) => { marker.setLatLng(ll).setOpacity(1); circle.setLatLng(ll).setStyle({ opacity: 1, fillOpacity: .12 }); cb.current({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) }); };
      map.on('click', (e: any) => set(e.latlng)); marker.on('dragend', () => set(marker.getLatLng()));
      api.current = { L, map, marker, circle };
    })();
    return () => { dead = true; api.current?.map.remove(); api.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const a = api.current; if (!a) return; a.circle.setRadius(radius); if (value) { a.marker.setLatLng(value).setOpacity(1); a.circle.setLatLng(value).setStyle({ opacity: 1, fillOpacity: .12 }); } }, [value, radius]);

  const fly = (p: LatLng) => { api.current?.map.setView([p.lat, p.lng], 17); onChange({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }); };
  async function search() {
    if (!q.trim()) return; setBusy(true); setMsg(''); setFound([]);
    try { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ar&q=${encodeURIComponent(q)}`); const j = await r.json(); setFound(j); if (!j.length) setMsg('لا توجد نتائج. جرّب اسماً آخر أو حرّك الخريطة واضغط على الموقع.'); }
    catch { setMsg('تعذر البحث الآن. يمكنك الضغط على الخريطة مباشرة.'); }
    setBusy(false);
  }
  function here() {
    if (!navigator.geolocation) return setMsg('المتصفح لا يدعم تحديد الموقع.');
    navigator.geolocation.getCurrentPosition((p) => fly({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setMsg('لم نتمكن من تحديد موقعك. اسمح للمتصفح بالوصول للموقع أو اختر من الخريطة.'), { enableHighAccuracy: true, timeout: 10000 });
  }
  return (<div className="stack">
    <div className="row"><div style={{ flex: 1, minWidth: 220 }}><input placeholder="ابحث عن عنوان أو حي أو معلم…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} /></div>
      <button type="button" className="btn" onClick={search} disabled={busy}>{busy ? <Spinner /> : 'بحث'}</button><button type="button" className="btn" onClick={here}>موقعي الحالي</button></div>
    {found.length > 0 && <div className="row">{found.map((r) => <button key={r.place_id} type="button" className="pill" onClick={() => { fly({ lat: +r.lat, lng: +r.lon }); onPlace?.(String(r.display_name).split(',').slice(0, 3).join('،')); setFound([]); }}>{String(r.display_name).split(',').slice(0, 3).join('،')}</button>)}</div>}
    {msg && <div className="muted small">{msg}</div>}
    <div ref={el} className="map" />
    <div className="muted small">{value ? '✓ تم تحديد الموقع — اسحب الدبوس أو اضغط مكاناً آخر لتعديله. الدائرة هي النطاق المسموح بالحضور منه.' : 'اضغط على الخريطة لتحديد موقع الفرع.'}</div>
  </div>);
}
