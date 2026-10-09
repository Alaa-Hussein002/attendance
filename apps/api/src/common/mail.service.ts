import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage { to: string; subject: string; html: string; text: string }

/** SMTP sender. Credentials come ONLY from environment variables (never from code or Git). */
@Injectable()
export class MailService {
  private log = new Logger('Mail');
  private tx: Transporter | null = null;

  get configured() { return !!(process.env.SMTP_USER && process.env.SMTP_PASS); }

  private transporter() {
    if (!this.tx) {
      this.tx = createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
        auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS ?? '').replace(/\s+/g, '') }, // Google shows app passwords with spaces
      });
    }
    return this.tx;
  }

  async send(m: MailMessage) {
    if (!this.configured) {
      if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
      this.log.warn(`SMTP not configured: email to ${m.to} was NOT sent. Dev copy:\n${m.text}`);
      return;
    }
    await this.transporter().sendMail({ from: `"${process.env.SMTP_FROM_NAME ?? 'Bayt Al Mosawer'}" <${process.env.SMTP_USER}>`, ...m });
  }
}
