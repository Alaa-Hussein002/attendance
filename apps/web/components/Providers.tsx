'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/* ---------- toasts ---------- */
type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; title: string; body?: string }
interface Toasts { success(title: string, body?: string): void; error(title: string, body?: string): void; info(title: string, body?: string): void }
/* ---------- dialogs ---------- */
interface ConfirmOpts { title: string; body?: ReactNode; confirmText?: string; danger?: boolean }
interface AskOpts { title: string; body?: string; label: string; minLength?: number; confirmText?: string }
interface NoticeOpts { title: string; body: ReactNode; tone?: 'info' | 'warn' }
type Dialog = ({ kind: 'notice'; opts: NoticeOpts; done: () => void } | { kind: 'confirm'; opts: ConfirmOpts; done: (v: boolean) => void } | { kind: 'ask'; opts: AskOpts; done: (v: string | null) => void }) | null;
/* ---------- server meta (clock, company, payroll month) ---------- */
export interface Meta { needsSetup: boolean; existingData: boolean; company: { name: string; code: string } | null; multiCompany: boolean; timezone: string; serverTime: string; today: string;
  payrollMonth: { year: number; month: number; from: string; to: string } }

const ToastCtx = createContext<Toasts>(null as any);
const DialogCtx = createContext<{ confirm: (o: ConfirmOpts) => Promise<boolean>; ask: (o: AskOpts) => Promise<string | null>; notice: (o: NoticeOpts) => Promise<void> }>(null as any);
const MetaCtx = createContext<{ meta: Meta | null; offsetMs: number; reload: () => void }>({ meta: null, offsetMs: 0, reload: () => {} });
export const useToast = () => useContext(ToastCtx);
export const useDialog = () => useContext(DialogCtx);
export const useMeta = () => useContext(MetaCtx);

export default function Providers({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [offsetMs, setOffset] = useState(0);
  const seq = useRef(0);

  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = ++seq.current; setToasts((t) => [...t.slice(-3), { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4200);
  }, []);
  const toast: Toasts = { success: (t, b) => push('success', t, b), error: (t, b) => push('error', t, b), info: (t, b) => push('info', t, b) };

  const confirm = (opts: ConfirmOpts) => new Promise<boolean>((res) => setDialog({ kind: 'confirm', opts, done: (v) => { setDialog(null); res(v); } }));
  const notice = (opts: NoticeOpts) => new Promise<void>((res) => setDialog({ kind: 'notice', opts, done: () => { setDialog(null); res(); } }));
  const ask = (opts: AskOpts) => new Promise<string | null>((res) => setDialog({ kind: 'ask', opts, done: (v) => { setDialog(null); res(v); } }));

  const reload = useCallback(() => { api<Meta>('/meta', { auth: false }).then((m) => { setMeta(m); setOffset(new Date(m.serverTime).getTime() - Date.now()); }).catch(() => {}); }, []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <ToastCtx.Provider value={toast}><DialogCtx.Provider value={{ confirm, ask, notice }}><MetaCtx.Provider value={{ meta, offsetMs, reload }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}><div><b>{t.title}</b>{t.body && <span>{t.body}</span>}</div>
          <button aria-label="إغلاق" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>×</button></div>))}</div>
      {dialog && <DialogView d={dialog} />}
    </MetaCtx.Provider></DialogCtx.Provider></ToastCtx.Provider>
  );
}

function DialogView({ d }: { d: NonNullable<Dialog> }) {
  const [text, setText] = useState('');
  if (d.kind === 'notice') return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && d.done()}><div className="modal" role="dialog" aria-modal>
      <div className="ico" style={{ background: d.opts.tone === 'warn' ? '#fdebe4' : 'var(--soft)' }}><span style={{ fontSize: 24 }}>{d.opts.tone === 'warn' ? '⏳' : 'ⓘ'}</span></div>
      <h3>{d.opts.title}</h3><div className="muted" style={{ lineHeight: 1.9 }}>{d.opts.body}</div>
      <div className="actions"><button className="btn primary" autoFocus onClick={() => d.done()}>حسناً</button></div></div></div>);
  if (d.kind === 'confirm') return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && d.done(false)}><div className="modal" role="dialog" aria-modal>
      <h3>{d.opts.title}</h3>{d.opts.body && <div className="muted">{d.opts.body}</div>}
      <div className="actions"><button className={`btn ${d.opts.danger ? 'accent' : 'primary'}`} autoFocus onClick={() => d.done(true)}>{d.opts.confirmText ?? 'تأكيد'}</button>
        <button className="btn" onClick={() => d.done(false)}>إلغاء</button></div></div></div>);
  const ok = text.trim().length >= (d.opts.minLength ?? 1);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && d.done(null)}><div className="modal" role="dialog" aria-modal>
      <h3>{d.opts.title}</h3>{d.opts.body && <p className="muted" style={{ marginTop: 0 }}>{d.opts.body}</p>}
      <div className="field"><label>{d.opts.label}</label><textarea rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} /></div>
      <div className="actions"><button className="btn primary" disabled={!ok} onClick={() => d.done(text.trim())}>{d.opts.confirmText ?? 'متابعة'}</button>
        <button className="btn" onClick={() => d.done(null)}>إلغاء</button></div></div></div>);
}
