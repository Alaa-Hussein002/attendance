const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const TITLES: Record<string, string> = {
  SETUP: 'تأكيد بريدك وإنشاء حساب مدير النظام',
  FIRST_LOGIN: 'تأكيد أول تسجيل دخول',
  DEVICE_CHANGE: 'تأكيد ربط جهاز جديد',
};

/** Brand email (Bayt Black / Paper / Accent Orange). Everything user-supplied is HTML-escaped. */
export function renderOtpEmail(a: { name: string; code: string; purpose: string; minutes: number }) {
  const title = TITLES[a.purpose] ?? 'رمز التحقق';
  const name = esc(a.name || '');
  const subject = `${a.code} هو رمز التحقق الخاص بك — بيت المصور`;
  const text = `بيت المصور\n\n${title}\n\nمرحباً ${a.name}،\nرمز التحقق: ${a.code}\nصالح لمدة ${a.minutes} دقائق. لا تشاركه مع أحد.\nإن لم تطلب هذا الرمز فتجاهل الرسالة.`;
  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;padding:0;background:#F3F1EC;font-family:Tahoma,Arial,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F1EC"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden">
<tr><td style="background:#111111;padding:24px 28px"><div style="color:#F3F1EC;font-size:22px;font-weight:700">بيت المصور</div><div style="color:#F3F1EC;opacity:.7;font-size:11px;letter-spacing:3px;direction:ltr;text-align:right;margin-top:4px">BAYT AL MOSAWER</div></td></tr>
<tr><td style="height:3px;background:#E65A2E;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px">
<div style="font-size:18px;font-weight:700;margin-bottom:12px">${title}</div>
<div style="font-size:14px;line-height:1.8;color:#444">مرحباً ${name}،<br>استخدم الرمز التالي لإكمال العملية:</div>
<div style="margin:22px 0;padding:18px;background:#F3F1EC;border-radius:12px;text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;direction:ltr">${esc(a.code)}</div>
<div style="font-size:13px;line-height:1.8;color:#666">الرمز صالح لمدة ${a.minutes} دقائق ويُستخدم مرة واحدة. لا تشاركه مع أحد، وإن لم تطلبه فتجاهل هذه الرسالة.</div>
</td></tr></table>
<div style="font-size:11px;color:#999;margin-top:16px">بيت المصور — Make room to create</div>
</td></tr></table></body></html>`;
  return { subject, html, text };
}
