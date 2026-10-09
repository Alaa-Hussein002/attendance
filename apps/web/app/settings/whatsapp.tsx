'use client';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../components/Providers';
import { Field, Spinner, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { errText } from '../../lib/errors';

const SAMPLES: [string, string, string][] = [['templateDaily', 'القالب اليومي (صباحاً)', 'مرحباً {{1}}، مهامك لهذا اليوم: {{2}}'], ['templateReminder', 'قالب التذكير (قبل الموعد بساعة)', 'تذكير {{1}}: مهمتك تبدأ بعد أقل من ساعة: {{2}}'], ['templateAssigned', 'قالب التكليف والتعديل والإلغاء', 'مرحباً {{1}}، تحديث بخصوص مهمتك: {{2}}']];
const blank = { enabled: false, phoneNumberId: '', businessAccountId: '', hasToken: false, templateDaily: '', templateReminder: '', templateAssigned: '', language: 'ar' };

export default function WhatsappTab() {
  const toast = useToast();
  const [c, setC] = useState<any>(blank); const [token, setToken] = useState(''); const [busy, setBusy] = useState(false); const [to, setTo] = useState(''); const [testing, setTesting] = useState(false); const [ready, setReady] = useState(false);
  const load = useCallback(() => api('/whatsapp/config').then((r) => { setC(r); setReady(true); }).catch((e) => toast.error('تعذر التحميل', errText(e))), [toast]);
  useEffect(() => { load(); }, [load]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setC({ ...c, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try { const r = await api('/whatsapp/config', { method: 'PUT', body: { ...c, accessToken: token || undefined } }); setC(r); setToken(''); toast.success('تم حفظ إعدادات واتساب', r.enabled ? 'الإرسال مفعّل' : 'الإرسال متوقف'); }
    catch (e) { toast.error('تعذر الحفظ', errText(e)); }
    setBusy(false);
  }
  async function test() { setTesting(true); try { const r = await api('/whatsapp/test', { method: 'POST', body: { to } }); r.ok ? toast.success('أُرسلت الرسالة التجريبية') : toast.error('فشل الإرسال', r.error); } catch (e) { toast.error('تعذر الاختبار', errText(e)); } setTesting(false); }
  if (!ready) return <div className="empty"><Spinner /></div>;

  return (<>
    <div className="alert warn" style={{ marginBottom: 18 }}><span>ⓘ</span><span>إرسال واتساب يحتاج اشتراكاً في <b>WhatsApp Business Platform</b> من Meta (خدمة مدفوعة) وقوالب رسائل معتمدة. حتى تفعّله يعمل النظام <b>بالبريد الإلكتروني</b> فقط، ولا يتأثر بشيء.</span></div>
    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><div><h2>الإرسال عبر واتساب</h2><p className="sub" style={{ margin: 0 }}>يصل للموظف نفس الإشعارات التي تصله بالبريد، على رقم جواله المسجّل.</p></div>
      <Switch checked={c.enabled} onChange={(v) => setC({ ...c, enabled: v })} /></div></div>
    <div className="card"><h2>بيانات الاتصال</h2><p className="sub">تجدها في لوحة Meta for Developers ← WhatsApp ← API Setup.</p>
      <div className="grid"><Field label="معرّف رقم الهاتف (Phone number ID)"><input dir="ltr" value={c.phoneNumberId} onChange={set('phoneNumberId')} /></Field>
        <Field label="معرّف حساب الأعمال (اختياري)"><input dir="ltr" value={c.businessAccountId} onChange={set('businessAccountId')} /></Field>
        <Field label="رمز الوصول (Access token)" help={c.hasToken ? '✓ محفوظ ومشفّر. اتركه فارغاً للإبقاء عليه.' : 'يُحفظ مشفّراً ولا يُعرض بعد الحفظ.'}><input type="password" dir="ltr" autoComplete="off" value={token} placeholder={c.hasToken ? '••••••••••••' : ''} onChange={(e) => setToken(e.target.value)} /></Field>
        <Field label="لغة القوالب"><select value={c.language} onChange={set('language')}><option value="ar">العربية (ar)</option><option value="en">English (en)</option></select></Field></div></div>
    <div className="card"><h2>أسماء القوالب المعتمدة</h2><p className="sub">أنشئ كل قالب في Meta بمتغيّرين: {'{{1}}'} اسم الموظف و{'{{2}}'} تفاصيل المهام. اكتب هنا اسم القالب كما اعتمدته.</p>
      <div className="stack">{SAMPLES.map(([k, label, sample]) => (<div key={k} className="grid"><Field label={label}><input dir="ltr" value={c[k]} onChange={set(k)} placeholder="اسم_القالب_بحروف_صغيرة" /></Field><div className="small muted" style={{ paddingTop: 28 }}>نص مقترح: {sample}</div></div>))}</div></div>
    <div className="card"><h2>رسالة تجريبية</h2><p className="sub">احفظ الإعدادات أولاً ثم جرّب.</p>
      <div className="row"><div style={{ width: 260 }}><input dir="ltr" placeholder="05xxxxxxxx أو +9665xxxxxxxx" value={to} onChange={(e) => setTo(e.target.value)} /></div><button className="btn" disabled={testing || !to.trim()} onClick={test}>{testing ? <Spinner /> : 'إرسال تجربة'}</button></div></div>
    <div className="savebar"><span className="small">{c.enabled ? 'الإرسال مفعّل' : 'الإرسال متوقف'}</span><button className="btn go" disabled={busy} onClick={save}>{busy ? <Spinner /> : 'حفظ الإعدادات'}</button></div>
  </>);
}
