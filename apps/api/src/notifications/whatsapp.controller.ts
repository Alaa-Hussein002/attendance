import { Body, Controller, Get, Injectable, Post, Put } from '@nestjs/common';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { ADMIN_ONLY, check } from '../common/http';
import { PrismaService } from '../common/prisma.service';
import { encryptSecret, normalizePhone } from './whatsapp';
import { WhatsappService } from './whatsapp.service';

interface Dto { enabled?: boolean; phoneNumberId?: string; businessAccountId?: string; accessToken?: string; clearToken?: boolean; templateDaily?: string; templateReminder?: string; templateAssigned?: string; language?: string }
const TPL = /^[a-z0-9_]{1,512}$/;

@Injectable()
export class WhatsappAdminService {
  constructor(private prisma: PrismaService, private wa: WhatsappService) {}
  /** Never returns the token: only whether one is stored. */
  async get(companyId: string) {
    const c = await this.wa.config(companyId);
    return { enabled: c?.enabled ?? false, phoneNumberId: c?.phoneNumberId ?? '', businessAccountId: c?.businessAccountId ?? '', hasToken: !!c?.accessTokenEnc,
      templateDaily: c?.templateDaily ?? '', templateReminder: c?.templateReminder ?? '', templateAssigned: c?.templateAssigned ?? '', language: c?.language ?? 'ar' };
  }
  async save(a: AuthCtx, d: Dto) {
    const cur = await this.wa.config(a.companyId);
    for (const k of ['templateDaily', 'templateReminder', 'templateAssigned'] as const) check(!d[k] || TPL.test(d[k]!), 'INVALID_TEMPLATE_NAME');
    check(!d.phoneNumberId || /^\d{5,30}$/.test(d.phoneNumberId.trim()), 'INVALID_PHONE_NUMBER_ID');
    const tokenEnc = d.clearToken ? null : d.accessToken?.trim() ? encryptSecret(d.accessToken.trim()) : cur?.accessTokenEnc ?? null;
    const data = { enabled: !!d.enabled, phoneNumberId: d.phoneNumberId?.trim() || null, businessAccountId: d.businessAccountId?.trim() || null, accessTokenEnc: tokenEnc,
      templateDaily: d.templateDaily?.trim() || null, templateReminder: d.templateReminder?.trim() || null, templateAssigned: d.templateAssigned?.trim() || null, language: d.language?.trim() || 'ar' };
    if (data.enabled) { check(data.phoneNumberId, 'WHATSAPP_NEEDS_PHONE_NUMBER_ID'); check(data.accessTokenEnc, 'WHATSAPP_NEEDS_TOKEN'); check(data.templateDaily || data.templateReminder || data.templateAssigned, 'WHATSAPP_NEEDS_TEMPLATE'); }
    await this.prisma.whatsappConfig.upsert({ where: { companyId: a.companyId }, create: { companyId: a.companyId, ...data }, update: data });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'WHATSAPP_CONFIG', entity: 'WhatsappConfig', entityId: a.companyId, after: { enabled: data.enabled, phoneNumberId: data.phoneNumberId, tokenChanged: !!d.accessToken?.trim() } as any } });
    return this.get(a.companyId);
  }
  async test(a: AuthCtx, to: string) {
    check(normalizePhone(to), 'INVALID_PHONE');
    try { const r: any = await this.wa.send(a.companyId, to, 'ASSIGNED', ['اختبار', 'رسالة تجريبية من نظام بيت المصور']); return r.skipped ? { ok: false, error: 'الإعدادات غير مكتملة أو غير مفعّلة' } : { ok: true }; }
    catch (e: any) { return { ok: false, error: String(e?.message ?? e).slice(0, 300) }; }
  }
}

@Controller('whatsapp')
export class WhatsappController {
  constructor(private svc: WhatsappAdminService) {}
  @Get('config') get(@Auth() a: AuthCtx) { requireRole(a, ...ADMIN_ONLY); return this.svc.get(a.companyId); }
  @Put('config') save(@Auth() a: AuthCtx, @Body() b: Dto) { requireRole(a, ...ADMIN_ONLY); return this.svc.save(a, b); }
  @Post('test') test(@Auth() a: AuthCtx, @Body() b: { to: string }) { requireRole(a, ...ADMIN_ONLY); return this.svc.test(a, b.to); }
}
