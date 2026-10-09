'use client';
import { ReactNode, useEffect, useRef } from 'react';

export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (<div className="page-head"><div><div className="rule" /><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{right && <div className="row">{right}</div>}</div>);
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (<label className="row" style={{ cursor: 'pointer', gap: 12 }}><span className="switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></span>{label && <span>{label}</span>}</label>);
}
export function Field({ label, help, error, children }: { label: ReactNode; help?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return (<div className="field"><label>{label}</label>{children}{error ? <div className="err">{error}</div> : help ? <div className="help">{help}</div> : null}</div>);
}
export const Spinner = () => <span className="spin" aria-label="جارٍ التحميل" />;

/** 6 separate boxes; supports typing, backspace and pasting the whole code. */
export function OtpInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const set = (v: string) => { const c = v.replace(/\D/g, '').slice(0, 6); onChange(c); if (c.length === 6) onComplete?.(c); };
  return (<div className="otp" dir="ltr" onPaste={(e) => { e.preventDefault(); set(e.clipboardData.getData('text')); refs.current[5]?.focus(); }}>
    {Array.from({ length: 6 }, (_, i) => (
      <input key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={1} value={value[i] ?? ''}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); if (!d) return; set(value.slice(0, i) + d + value.slice(i + 1)); refs.current[Math.min(i + 1, 5)]?.focus(); }}
        onKeyDown={(e) => { if (e.key === 'Backspace') { e.preventDefault(); set(value.slice(0, i > value.length - 1 ? value.length - 1 : i) + value.slice(i + 1)); refs.current[Math.max(i - (value[i] ? 0 : 1), 0)]?.focus(); } }} />))}
  </div>);
}

/** Mirrors the server's password policy so the user sees problems before submitting. */
export function passwordChecks(pw: string, confirm?: string) {
  return [
    { ok: pw.length >= 8, text: '8 خانات على الأقل' },
    { ok: /[A-Za-z\u0600-\u06FF]/.test(pw) && /\d/.test(pw), text: 'تحتوي حرفاً ورقماً' },
    { ok: pw !== '12345678' && !/^(.)\1+$/.test(pw) && pw.length > 0, text: 'ليست كلمة بسيطة أو الافتراضية' },
    ...(confirm !== undefined ? [{ ok: pw.length > 0 && pw === confirm, text: 'التأكيد مطابق' }] : []),
  ];
}
export function PasswordRules({ pw, confirm }: { pw: string; confirm?: string }) {
  return (<div className="rules">{passwordChecks(pw, confirm).map((c) => <div key={c.text} className={c.ok ? 'okk' : ''}>{c.ok ? '✓' : '○'} {c.text}</div>)}</div>);
}
