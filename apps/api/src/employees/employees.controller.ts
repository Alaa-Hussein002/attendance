import { Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { check, HR_ROLES } from '../common/http';
import { PrismaService } from '../common/prisma.service';
import { DEFAULT_PASSWORD } from '../auth/password';
import { hashPassword } from '../auth/crypto';
import { toLocalParts } from '@attendance/shared';

const SAFE = { startDate: true, endDate: true, id: true, name: true, email: true, phone: true, role: true, branchId: true, policyId: true, baseSalary: true, active: true,
  mustChangePassword: true, tracksAttendance: true, biometricId: true } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF = ['EMPLOYEE', 'PHOTOGRAPHER', 'TEAM_LEAD', 'BRANCH_MANAGER'];
/** Which roles each role may assign. HR cannot mint admins or other HR. */
const ASSIGNABLE: Record<string, string[]> = {
  HR: STAFF,
  COMPANY_ADMIN: [...STAFF, 'HR', 'COMPANY_ADMIN'],
  SUPER_ADMIN: [...STAFF, 'HR', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
};

interface CreateDto { startDate?: string; name: string; email: string; role?: string; branchId?: string; phone?: string; baseSalary?: number; policyId?: string | null; tracksAttendance?: boolean; biometricId?: string }
interface UpdateDto { startDate?: string | null; endDate?: string | null; name?: string; phone?: string; role?: string; branchId?: string | null; baseSalary?: number; active?: boolean; policyId?: string | null; tracksAttendance?: boolean; biometricId?: string | null }

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}
  private async today(companyId: string) { return toLocalParts(new Date(), (await this.prisma.company.findUnique({ where: { id: companyId } }))!.timezone).date; }

  private async refs(companyId: string, branchId?: string | null, policyId?: string | null) {
    if (branchId) check(await this.prisma.branch.findFirst({ where: { id: branchId, companyId } }), 'BRANCH_NOT_FOUND');
    if (policyId) check(await this.prisma.attendancePolicy.findFirst({ where: { id: policyId, companyId } }), 'POLICY_NOT_FOUND');
  }
  private strip(a: AuthCtx, u: any) { if (!HR_ROLES.includes(a.role)) delete u.baseSalary; return u; } // salary: HR/admin only

  async list(a: AuthCtx) {
    const where: any = { companyId: a.companyId };
    if (a.role === 'BRANCH_MANAGER') {
      const me = await this.prisma.user.findFirst({ where: { id: a.userId, companyId: a.companyId } });
      where.branchId = me?.branchId ?? '__none__';
    }
    return (await this.prisma.user.findMany({ where, select: SAFE, orderBy: { name: 'asc' } })).map((u: any) => this.strip(a, u));
  }

  /** New staff get the shared default password; they must confirm by email OTP and choose their own at first login. */
  async create(a: AuthCtx, d: CreateDto) {
    const role = d.role ?? 'EMPLOYEE';
    check(ASSIGNABLE[a.role]?.includes(role), 'ROLE_NOT_ALLOWED');
    check(d.name?.trim(), 'NAME_REQUIRED');
    check(EMAIL_RE.test(d.email ?? ''), 'INVALID_EMAIL');
    check(d.baseSalary === undefined || (d.baseSalary >= 0 && isFinite(d.baseSalary)), 'INVALID_SALARY');
    check(d.startDate === undefined || /^\d{4}-\d{2}-\d{2}$/.test(d.startDate), 'INVALID_DATE');
    await this.refs(a.companyId, d.branchId, d.policyId);
    const email = d.email.trim().toLowerCase();
    check(!(await this.prisma.user.findFirst({ where: { companyId: a.companyId, email } })), 'EMAIL_EXISTS');
    const u = await this.prisma.user.create({ data: { companyId: a.companyId, name: d.name.trim(), email, phone: d.phone?.trim() || null, role: role as any,
      branchId: d.branchId ?? null, policyId: d.policyId ?? null, baseSalary: d.baseSalary ?? 0, tracksAttendance: d.tracksAttendance ?? true,
      biometricId: d.biometricId?.trim() || null, startDate: d.startDate ?? (await this.today(a.companyId)), passwordHash: hashPassword(DEFAULT_PASSWORD), mustChangePassword: true }, select: SAFE });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'EMPLOYEE_CREATE', entity: 'User', entityId: u.id, after: u as any } });
    return u;
  }

  async update(a: AuthCtx, id: string, d: UpdateDto) {
    const before = await this.prisma.user.findFirst({ where: { id, companyId: a.companyId }, select: SAFE });
    if (!before) throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    if (a.role === 'HR' && !STAFF.includes(before.role)) throw new ForbiddenException('ROLE_NOT_ALLOWED');
    if (d.role !== undefined) check(ASSIGNABLE[a.role]?.includes(d.role), 'ROLE_NOT_ALLOWED');
    if (d.baseSalary !== undefined) check(d.baseSalary >= 0 && isFinite(d.baseSalary), 'INVALID_SALARY');
    if (d.name !== undefined) check(d.name.trim(), 'NAME_REQUIRED');
    if (id === a.userId && d.active === false) check(false, 'CANNOT_DEACTIVATE_SELF');
    check(d.startDate == null || /^\d{4}-\d{2}-\d{2}$/.test(d.startDate), 'INVALID_DATE'); check(d.endDate == null || /^\d{4}-\d{2}-\d{2}$/.test(d.endDate), 'INVALID_DATE');
    await this.refs(a.companyId, d.branchId, d.policyId);
    const data: any = {};
    for (const k of ['name', 'phone', 'role', 'branchId', 'baseSalary', 'active', 'policyId', 'tracksAttendance', 'biometricId', 'startDate', 'endDate'] as const) if (d[k] !== undefined) data[k] = d[k];
    // leaving: the last working day defaults to today; coming back clears it
    if (d.active === false && d.endDate === undefined && !before.endDate) data.endDate = await this.today(a.companyId);
    if (d.active === true && !before.active && d.endDate === undefined) data.endDate = null;
    const u = await this.prisma.user.update({ where: { id }, data, select: SAFE });
    if (d.active === false) await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'EMPLOYEE_UPDATE', entity: 'User', entityId: id, before: before as any, after: u as any } });
    return u;
  }

  /** Forgot password: back to the shared default; the employee repeats the OTP + new-password step. */
  async resetPassword(a: AuthCtx, id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, companyId: a.companyId } });
    if (!u) throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    if (a.role === 'HR' && !STAFF.includes(u.role)) throw new ForbiddenException('ROLE_NOT_ALLOWED');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(DEFAULT_PASSWORD), mustChangePassword: true, failedLogins: 0, lockedUntil: null } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'PASSWORD_RESET', entity: 'User', entityId: id } }),
    ]);
    return { ok: true };
  }

  /** Lost/changed phone: HR unbinds the device; the employee must re-verify with OTP. */
  async resetDevice(a: AuthCtx, id: string, reason: string) {
    check(reason?.trim().length >= 3, 'REASON_REQUIRED');
    const u = await this.prisma.user.findFirst({ where: { id, companyId: a.companyId } });
    if (!u) throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    await this.prisma.$transaction([
      this.prisma.device.updateMany({ where: { userId: id, active: true }, data: { active: false } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'DEVICE_RESET', entity: 'User', entityId: id, reason } }),
    ]);
    return { ok: true };
  }
}

@Controller('employees')
export class EmployeesController {
  constructor(private svc: EmployeesService) {}
  @Get() list(@Auth() a: AuthCtx) { requireRole(a, ...HR_ROLES, 'BRANCH_MANAGER', 'TEAM_LEAD'); return this.svc.list(a); }
  @Post() create(@Auth() a: AuthCtx, @Body() b: CreateDto) { requireRole(a, ...HR_ROLES); return this.svc.create(a, b); }
  @Put(':id') update(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: UpdateDto) { requireRole(a, ...HR_ROLES); return this.svc.update(a, id, b); }
  @Post(':id/reset-password') resetPassword(@Auth() a: AuthCtx, @Param('id') id: string) { requireRole(a, ...HR_ROLES); return this.svc.resetPassword(a, id); }
  @Post(':id/reset-device') reset(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: { reason: string }) { requireRole(a, ...HR_ROLES); return this.svc.resetDevice(a, id, b.reason); }
}
