import { createTransport } from 'nodemailer';

function transporter() {
  return createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS ?? '').replace(/\s+/g, '') },
  });
}

export interface LicenseEmail {
  to: string;
  serial: string;
  key: string;
  planName: string;
  validUntil: string;
  locale: 'ar' | 'en';
  vendorUrl: string;
}

export async function sendLicenseEmail(m: LicenseEmail) {
  const ar = m.locale === 'ar';
  const subject = ar ? 'مفتاح الاشتراك — بيت المصور' : 'Your subscription key — Bayt Al Mosawer';
  const html = ar
    ? `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>شكراً لاشتراكك في بيت المصور</h2>
        <p>تم إصدار مفتاح الاشتراك الخاص بك. انسخه كاملاً والصقه في صفحة الاشتراك داخل النظام.</p>
        <p><b>الرقم التسلسلي (للمرجع):</b> <code>${m.serial}</code></p>
        <p><b>مفتاح التفعيل:</b></p>
        <pre style="background:#f3f1ec;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all;font-size:12px">${m.key}</pre>
        <p><b>الباقة:</b> ${m.planName} — <b>صالح حتى:</b> ${m.validUntil}</p>
        <p>لأجل التفعيل: افتح النظام → الاشتراك → الصق المفتاح → تفعيل.</p>
        <p style="color:#666;font-size:12px">إذا لم تطلب هذا، تجاهل الرسالة. الدعم: ${m.vendorUrl}</p>
      </div>`
    : `<div dir="ltr" style="font-family:system-ui,Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>Thank you for subscribing to Bayt Al Mosawer</h2>
        <p>Your subscription key has been issued. Copy it in full and paste it into the Subscription page inside the system.</p>
        <p><b>Serial (for reference):</b> <code>${m.serial}</code></p>
        <p><b>Activation key:</b></p>
        <pre style="background:#f3f1ec;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all;font-size:12px">${m.key}</pre>
        <p><b>Plan:</b> ${m.planName} — <b>Valid until:</b> ${m.validUntil}</p>
        <p>To activate: open the system → Subscription → paste the key → Activate.</p>
        <p style="color:#666;font-size:12px">If you did not request this, ignore the message. Support: ${m.vendorUrl}</p>
      </div>`;
  const text = ar
    ? `مفتاح الاشتراك — بيت المصور\n\nالرقم التسلسلي: ${m.serial}\n\nمفتاح التفعيل:\n${m.key}\n\nالباقة: ${m.planName} — صالح حتى: ${m.validUntil}\n\nللتفعيل: افتح النظام → الاشتراك → الصق المفتاح → تفعيل.\nالدعم: ${m.vendorUrl}`
    : `Subscription key — Bayt Al Mosawer\n\nSerial: ${m.serial}\n\nActivation key:\n${m.key}\n\nPlan: ${m.planName} — Valid until: ${m.validUntil}\n\nTo activate: open the system → Subscription → paste the key → Activate.\nSupport: ${m.vendorUrl}`;
  const configured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  if (!configured) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
    console.warn(`[mailer] SMTP not configured — email to ${m.to} NOT sent. Dev copy:\n${text}`);
    return;
  }
  await transporter().sendMail({
    from: `"${process.env.SMTP_FROM_NAME ?? 'Bayt Al Mosawer'}" <${process.env.SMTP_USER}>`,
    to: m.to, subject, html, text,
  });
}
