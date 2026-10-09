import { fmtDayAr, fmtTime12Ar } from '@attendance/shared';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export interface TaskLine { title: string; date: string; startMinutes: number; endMinutes: number; address?: string | null; details?: string | null; lat: number; lng: number }
export const mapUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
export const timeRange = (t: Pick<TaskLine, 'startMinutes' | 'endMinutes'>) => `${fmtTime12Ar(t.startMinutes)} – ${fmtTime12Ar(t.endMinutes)}`;

/** One short text per task: used for the plain-text email part and for WhatsApp template variables. */
export const taskSummary = (t: TaskLine) => `${t.title} — ${fmtDayAr(t.date)} ${timeRange(t)}${t.address ? ` — ${t.address}` : ''}`;

/** Brand email for assignments, updates, cancellations, the morning digest and the hour-before reminder. */
export function renderTaskEmail(a: { name: string; headline: string; intro: string; tasks: TaskLine[] }) {
  const subject = `${a.headline} — بيت المصور`;
  const text = `بيت المصور\n\n${a.headline}\n\nمرحباً ${a.name}،\n${a.intro}\n\n${a.tasks.map((t, i) => `${i + 1}. ${taskSummary(t)}${t.details ? `\n   ${t.details}` : ''}\n   الموقع: ${mapUrl(t.lat, t.lng)}`).join('\n\n')}`;
  const items = a.tasks.map((t) => `<tr><td style="padding:14px 0;border-top:1px solid #ECE9E1">
<div style="font-size:16px;font-weight:700">${esc(t.title)}</div>
<div style="font-size:13px;color:#6d6b64;margin-top:4px">${esc(fmtDayAr(t.date))} · ${esc(timeRange(t))}</div>
${t.address ? `<div style="font-size:13px;margin-top:4px">📍 ${esc(t.address)}</div>` : ''}
${t.details ? `<div style="font-size:13px;color:#444;margin-top:6px;line-height:1.8;white-space:pre-line">${esc(t.details)}</div>` : ''}
<a href="${mapUrl(t.lat, t.lng)}" style="display:inline-block;margin-top:10px;background:#111111;color:#F3F1EC;text-decoration:none;font-size:13px;font-weight:700;padding:9px 16px;border-radius:10px">فتح الموقع على الخريطة</a></td></tr>`).join('');
  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#F3F1EC;font-family:Tahoma,Arial,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden">
<tr><td style="background:#111111;padding:22px 28px"><div style="color:#F3F1EC;font-size:22px;font-weight:700">بيت المصور</div><div style="color:#F3F1EC;opacity:.7;font-size:11px;letter-spacing:3px;direction:ltr;text-align:right;margin-top:4px">BAYT AL MOSAWER</div></td></tr>
<tr><td style="height:3px;background:#E65A2E;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:26px 28px"><div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(a.headline)}</div>
<div style="font-size:14px;line-height:1.8;color:#444">مرحباً ${esc(a.name)}،<br>${esc(a.intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">${items}</table></td></tr></table>
<div style="font-size:11px;color:#999;margin-top:16px">بيت المصور — Make room to create</div></td></tr></table></body></html>`;
  return { subject, html, text };
}
