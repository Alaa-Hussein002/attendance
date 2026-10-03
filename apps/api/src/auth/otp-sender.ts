import { Injectable } from '@nestjs/common';

export interface OtpMessage { email: string; phone?: string | null; code: string; purpose: string }

/** Inject a real SMS/email provider implementation in production. */
export abstract class OtpSender { abstract send(msg: OtpMessage): Promise<void>; }

@Injectable()
export class ConsoleOtpSender extends OtpSender {
  async send(msg: OtpMessage) {
    if (process.env.NODE_ENV === 'production') throw new Error('ConsoleOtpSender must not be used in production: configure an SMS/email provider');
    console.log(`[DEV OTP] ${msg.email} (${msg.purpose}): ${msg.code}`);
  }
}
