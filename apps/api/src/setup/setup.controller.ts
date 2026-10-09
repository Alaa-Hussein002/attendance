import { Body, Controller, ForbiddenException, Get, HttpException, Injectable, Ip, Post } from '@nestjs/common';
import { DEFAULT_POLICY, normalizePolicy, periodBounds, periodOf, toLocalParts } from '@attendance/shared';
import { check } from '../common/http';
import { PrismaService } from '../common/prisma.service';
import { RateLimiter } from '../common/rate-limit';
import { Public } from '../auth/public.decorator';
import { AuthService } from '../auth/auth.service';
import { hashPassword } from '../auth/crypto';
import { validateNewPassword } from '../auth/password';
import { Prisma } from '@prisma/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const limiter = new RateLimiter(5, 3600_000);

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function validTimezone(tz: string) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }

@Injectable()
export class SetupService {
  constructor(private prisma: PrismaService, private auth: AuthService) {}

  /** Public facts the login/setup screens need. The clock is the SERVER's, in the company timezone, Gregorian calendar. */
  async meta() {
    const verified = await this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } });
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true, slug: true, timezone: true }, take: 2 });
    const c = companies.length === 1 ? companies[0] : null;
    const timezone = c?.timezone ?? 'Asia/Riyadh';
    const now = new Date();
    const local = toLocalParts(now, timezone);
    const pol = c ? await this.prisma.attendancePolicy.findFirst({ where: { companyId: c.id, isDefault: true, active: true } }) : null;
    const startDay = pol ? normalizePolicy(pol.config).payrollStartDay : DEFAULT_POLICY.payrollStartDay;
    const pm = periodOf(local.date, startDay);
    return { needsSetup: verified === 0, existingData: companies.length > 0, company: c ? { name: c.name, code: c.slug } : null, multiCompany: companies.length > 1,
      timezone, serverTime: now.toISOString(), today: local.date, payrollMonth: { ...pm, ...periodBounds(pm.year, pm.month, startDay) } };
  }

  /** Removes a half-finished setup (unverified companies) so the wizard can be restarted. Verified data is never touched. */
  private async purgeUnverified() {
    const ids = (await this.prisma.company.findMany({ where: { users: { none: { emailVerifiedAt: { not: null } } } }, select: { id: true } })).map((c: { id: string }) => c.id);
    if (!ids.length) return;
    const inC = { companyId: { in: ids } };
    const ofUser = { user: { companyId: { in: ids } } };
    await this.prisma.$transaction([
      this.prisma.otpChallenge.deleteMany({ where: ofUser }), this.prisma.refreshToken.deleteMany({ where: ofUser }), this.prisma.device.deleteMany({ where: ofUser }),
      this.prisma.excuseRequest.deleteMany({ where: inC }), this.prisma.excuse.deleteMany({ where: inC }), this.prisma.leaveRequest.deleteMany({ where: inC }),
      this.prisma.attendanceRecord.deleteMany({ where: inC }), this.prisma.monthlySummary.deleteMany({ where: inC }), this.prisma.auditLog.deleteMany({ where: inC }),
      this.prisma.holiday.deleteMany({ where: inC }), this.prisma.leaveType.deleteMany({ where: inC }), this.prisma.biometricDevice.deleteMany({ where: inC }),
      this.prisma.user.deleteMany({ where: inC }), this.prisma.branch.deleteMany({ where: inC }), this.prisma.attendancePolicy.deleteMany({ where: inC }),
      this.prisma.company.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }

  async start(ip: string, b: { companyName: string; adminName: string; email: string; password: string; timezone?: string; setupKey?: string }) {
    if (!limiter.allow(ip)) throw new HttpException({ code: 'TOO_MANY_REQUESTS' }, 429);
    if ((await this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } })) > 0) throw new ForbiddenException('SETUP_ALREADY_DONE');
    if (process.env.SETUP_KEY && b.setupKey !== process.env.SETUP_KEY) throw new ForbiddenException('INVALID_SETUP_KEY');
    check(b.companyName?.trim(), 'COMPANY_NAME_REQUIRED');
    check(b.adminName?.trim(), 'NAME_REQUIRED');
    check(EMAIL_RE.test(b.email ?? ''), 'INVALID_EMAIL');
    const pwErr = validateNewPassword(b.password); check(!pwErr, pwErr ?? '');
    const timezone = b.timezone || 'Asia/Riyadh'; check(validTimezone(timezone), 'INVALID_TIMEZONE');

    await this.purgeUnverified();
    let slug = slugify(b.companyName) || 'company';
    while (await this.prisma.company.findUnique({ where: { slug } })) slug = `${slug}-${Math.random().toString(16).slice(2, 6)}`;
    const email = b.email.trim().toLowerCase();
    const today = toLocalParts(new Date(), timezone).date;

    const admin = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const company = await tx.company.create({ data: { name: b.companyName.trim(), slug, timezone } });
      await tx.attendancePolicy.create({ data: { companyId: company.id, name: 'السياسة الافتراضية', config: DEFAULT_POLICY as any, effectiveFrom: today, isDefault: true, createdById: 'setup' } });
      return tx.user.create({ data: { companyId: company.id, role: 'COMPANY_ADMIN', name: b.adminName.trim(), email, passwordHash: hashPassword(b.password), active: false, tracksAttendance: false } });
    });
    return this.auth.startOtp(admin, 'web', 'SETUP'); // the admin becomes active only after the email OTP is confirmed
  }
}

@Public()
@Controller()
export class SetupController {
  constructor(private svc: SetupService) {}
  @Get('meta') meta() { return this.svc.meta(); }
  @Post('setup/start') start(@Ip() ip: string, @Body() b: any) { return this.svc.start(ip, b); }
}
