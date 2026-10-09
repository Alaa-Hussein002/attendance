'use client';
import { useRef } from 'react';

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
function hexToHsv(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); const n = parseInt(m ? m[1] : '777777', 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
}
export function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
const SWATCHES = ['#22a559', '#e65a2e', '#111111', '#2f6fed', '#f0b429', '#8e44ad', '#16a3a3', '#c8321c'];

/** Hue around the ring, saturation towards the edge, brightness on the slider. */
export default function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, s, v] = hexToHsv(value);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    onChange(hsvToHex((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, clamp(Math.hypot(dx, dy) / (r.width / 2)), v || 1));
  };
  const a = (h * Math.PI) / 180;
  return (
    <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
      <div>
        <div ref={ref} className="wheel" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }} onPointerMove={(e) => e.buttons === 1 && pick(e)} role="slider" aria-label="اختيار اللون">
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#000', opacity: 1 - v, pointerEvents: 'none' }} />
          <div className="pin" style={{ left: `${50 + Math.cos(a) * s * 50}%`, top: `${50 + Math.sin(a) * s * 50}%`, background: value }} />
        </div>
        <input type="range" min={15} max={100} value={Math.round(v * 100)} onChange={(e) => onChange(hsvToHex(h, s, Number(e.target.value) / 100))} style={{ marginTop: 12, padding: 0 }} aria-label="سطوع اللون" />
      </div>
      <div className="stack" style={{ minWidth: 150 }}>
        <div className="row"><span className="dot" style={{ width: 34, height: 34, background: value, borderRadius: 10 }} /><input dir="ltr" value={value} maxLength={7} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)} style={{ width: 110 }} /></div>
        <div className="row" style={{ gap: 6 }}>{SWATCHES.map((c) => <button key={c} type="button" aria-label={c} onClick={() => onChange(c)} className="dot" style={{ width: 24, height: 24, background: c, border: c === value ? '3px solid var(--black)' : '1px solid var(--line)', cursor: 'pointer', padding: 0 }} />)}</div>
      </div>
    </div>
  );
}
