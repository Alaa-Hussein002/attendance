import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { renderOtpEmail } from '../common/email-templates';
import { MailService } from '../common/mail.service';
import { OTP_TTL_MINUTES } from './otp';

export interface OtpMessage { email: string; phone?: string | null; name: string; code: string; purpose: string }

export abstract class OtpSender { abstract send(msg: OtpMessage): Promise<void>; }

@Injectable()
export class EmailOtpSender extends OtpSender {
  private log = new Logger('OtpSender');
  constructor(private mail: MailService) { super(); }
  async send(m: OtpMessage) {
    const { subject, html, text } = renderOtpEmail({ name: m.name, code: m.code, purpose: m.purpose, minutes: OTP_TTL_MINUTES });
    try { await this.mail.send({ to: m.email, subject, html, text }); }
    catch (e: any) { this.log.error(`OTP email failed: ${e?.message}`); throw new ServiceUnavailableException('EMAIL_SEND_FAILED'); }
  }
}
