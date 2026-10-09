import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { buildTemplatePayload, decryptSecret, normalizePhone } from './whatsapp';

const GRAPH = 'https://graph.facebook.com/v20.0';
export type WaKind = 'DAILY' | 'REMINDER' | 'ASSIGNED';

@Injectable()
export class WhatsappService {
  private log = new Logger('WhatsApp');
  constructor(private prisma: PrismaService) {}

  config(companyId: string) { return this.prisma.whatsappConfig.findUnique({ where: { companyId } }); }

  /** Is WhatsApp switched on and complete for this company? */
  async ready(companyId: string, kind: WaKind) {
    const c = await this.config(companyId); if (!c?.enabled || !c.phoneNumberId || !c.accessTokenEnc) return null;
    const template = kind === 'DAILY' ? c.templateDaily : kind === 'REMINDER' ? c.templateReminder : c.templateAssigned;
    return template ? { c, template } : null;
  }

  async send(companyId: string, phone: string, kind: WaKind, params: string[]) {
    const r = await this.ready(companyId, kind); if (!r) return { skipped: true };
    const to = normalizePhone(phone); if (!to) throw new Error('INVALID_PHONE');
    const res = await fetch(`${GRAPH}/${r.c.phoneNumberId}/messages`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${decryptSecret(r.c.accessTokenEnc!)}` },
      body: JSON.stringify(buildTemplatePayload({ to, template: r.template, language: r.c.language || 'ar', params })) });
    if (!res.ok) { const body: any = await res.json().catch(() => ({})); const m = body?.error?.message ?? `HTTP ${res.status}`; this.log.warn(`WhatsApp send failed: ${m}`); throw new Error(m); }
    return { sent: true };
  }
}
