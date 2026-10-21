import { ForbiddenException, Injectable } from '@nestjs/common';
import { canAddBranch, canAddEmployee, canUseFeature, Capabilities, evaluateLicense, Feature, LicenseStatus } from '@attendance/shared';
import { randomUUID } from 'crypto';
import { AuthCtx, requireRole } from '../common/auth-context';
import { ADMIN_ONLY } from '../common/http';
import { PrismaService } from '../common/prisma.service';
import { parsePublicKey, verifyLicense } from './license';

export type FullStatus = LicenseStatus & { installationId: string; usage: { employees: number; branches: number }; keyProblem: string | null; publicKeyConfigured: boolean; clockRolledBack: boolean };

@Injectable()
export class LicenseService {
  private cache: { at: number; v: FullStatus } | null = null;
  constructor(private prisma: PrismaService) {}
  private pub() { return parsePublicKey(process.env.LICENSE_PUBLIC_KEY); }
  private async row() { return (await this.prisma.licenseState.findUnique({ where: { id: 'main' } })) ?? this.prisma.licenseState.create({ data: { id: 'main', installationId: randomUUID() } }); }

  /** Never trusts a rolled-back clock: the effective time is the latest moment this installation has ever seen. */
  async status(fresh = false): Promise<FullStatus> {
    if (!fresh && this.cache && Date.now() - this.cache.at < 30_000) return this.cache.v;
    const row = await this.row(); const now = new Date(); const effective = now > row.lastSeenAt ? now : row.lastSeenAt;
    if (now.getTime() - row.lastSeenAt.getTime() > 3600_000) await this.prisma.licenseState.update({ where: { id: 'main' }, data: { lastSeenAt: now } });
    let payload = null; let keyProblem: string | null = null;
    if (row.licenseKey) { const v = verifyLicense(row.licenseKey, this.pub()); if (!v.ok) keyProblem = v.reason; else if (v.payload.installationId && v.payload.installationId !== row.installationId) keyProblem = 'WRONG_INSTALLATION'; else payload = v.payload; }
    const [employees, branches] = await Promise.all([
      this.prisma.user.count({ where: { active: true, tracksAttendance: true, role: { notIn: ['COMPANY_ADMIN', 'SUPER_ADMIN'] } } }), this.prisma.branch.count() ]);
    const v: FullStatus = { ...evaluateLicense({ payload, trialStartedAt: row.trialStartedAt, now: effective }), installationId: row.installationId, usage: { employees, branches }, keyProblem,
      publicKeyConfigured: !!this.pub(), clockRolledBack: row.lastSeenAt.getTime() - now.getTime() > 86400_000 };
    this.cache = { at: Date.now(), v }; return v;
  }
  private deny(code: string, extra: object = {}): never { throw new ForbiddenException({ code, ...extra }); }
  async assertCan(cap: keyof Capabilities) { if (!(await this.status()).capabilities[cap]) this.deny('LICENSE_RESTRICTED'); }
  async assertCanAddEmployee() { const s = await this.status(true); const d = canAddEmployee(s, s.usage.employees); if (d) this.deny(d, { limit: s.limits.employees }); }
  async assertCanAddBranch() { const s = await this.status(true); const d = canAddBranch(s, s.usage.branches); if (d) this.deny(d, { limit: s.limits.branches }); }
  async assertFeature(f: Feature) { const d = canUseFeature(await this.status(), f); if (d) this.deny(d, { feature: f }); }

  async activate(a: AuthCtx, key: string) {
    const v = verifyLicense(key, this.pub());
    if (!v.ok) this.deny(v.reason === 'NO_PUBLIC_KEY' ? 'LICENSE_NO_PUBLIC_KEY' : 'LICENSE_INVALID_KEY', { reason: v.reason });
    const row = await this.row();
    if (v.payload.installationId && v.payload.installationId !== row.installationId) this.deny('LICENSE_WRONG_INSTALLATION');
    await this.prisma.licenseState.update({ where: { id: 'main' }, data: { licenseKey: key.trim(), activatedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'LICENSE_ACTIVATE', entity: 'License', entityId: v.payload.id, after: { plan: v.payload.plan, validUntil: v.payload.validUntil } as any } });
    return this.status(true);
  }
}
