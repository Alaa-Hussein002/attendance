import { Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { check, HR_ROLES } from '../common/http';
import { PrismaService } from '../common/prisma.service';
import { hashPassword } from '../auth/crypto';

const SAFE = { id: true, name: true, email: true, phone: true, role: true, branchId: true, policyId: true, baseSalary: true, active: true } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Which roles each role may assign. HR cannot mint admins. */
const ASSIGNABLE: Record<string, string[]> = { HR: ['EMPLOYEE', 'BRANCH_MANAGER'], COMPANY_ADMIN: ['EMPLOYEE', 'BRANCH_MANAGER', 'HR', 'COMPANY_ADMIN'] };

interface CreateDto { name: string; email: string; password: string; role?: string; branchId?: string; phone?: string; baseSalary?: number; policyId?: string | null }
interface UpdateDto { name?: string; phone?: string; role?: string; branchId?: string | null; baseSalary?: number; active?: boolean; policyId?: string | null }

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

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

  async create(a: AuthCtx, d: CreateDto) {
    const role = d.role ?? 'EMPLOYEE';
    check(ASSIGNABLE[a.role]?.includes(role), 'ROLE_NOT_ALLOWED');
    check(d.name?.trim(), 'NAME_REQUIRED');
    check(EMAIL_RE.test(d.email ?? ''), 'INVALID_EMAIL');
    check(typeof d.password === 'string' && d.password.length >= 10, 'WEAK_PASSWORD');
    check(d.baseSalary === undefined || (d.baseSalary >= 0 && isFinite(d.baseSalary)), 'INVALID_SALARY');
    await this.refs(a.companyId, d.branchId, d.policyId);
    const email = d.email.trim().toLowerCase();
    check(!(await this.prisma.user.findFirst({ where: { companyId: a.companyId, email } })), 'EMAIL_EXISTS');
    const u = await this.prisma.user.create({ data: { companyId: a.companyId, name: d.name.trim(), email, phone: d.phone, role: role as any,
      branchId: d.branchId ?? null, policyId: d.policyId ?? null, baseSalary: d.baseSalary ?? 0, passwordHash: hashPassword(d.password) }, select: SAFE });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'EMPLOYEE_CREATE', entity: 'User', entityId: u.id, after: u as any } });
    return u;
  }

  async update(a: AuthCtx, id: string, d: UpdateDto) {
    const before = await this.prisma.user.findFirst({ where: { id, companyId: a.companyId }, select: SAFE });
    if (!before) throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    // an HR user may not edit admins/other HR, nor escalate roles
    if (a.role === 'HR' && !['EMPLOYEE', 'BRANCH_MANAGER'].includes(before.role)) throw new ForbiddenException('ROLE_NOT_ALLOWED');
    if (d.role !== undefined) check(ASSIGNABLE[a.role]?.includes(d.role), 'ROLE_NOT_ALLOWED');
    if (d.baseSalary !== undefined) check(d.baseSalary >= 0 && isFinite(d.baseSalary), 'INVALID_SALARY');
    if (d.name !== undefined) check(d.name.trim(), 'NAME_REQUIRED');
    if (id === a.userId && d.active === false) check(false, 'CANNOT_DEACTIVATE_SELF');
    await this.refs(a.companyId, d.branchId, d.policyId);
    const data: any = {};
    for (const k of ['name', 'phone', 'role', 'branchId', 'baseSalary', 'active', 'policyId'] as const) if (d[k] !== undefined) data[k] = d[k];
    const u = await this.prisma.user.update({ where: { id }, data, select: SAFE });
    if (d.active === false) await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'EMPLOYEE_UPDATE', entity: 'User', entityId: id, before: before as any, after: u as any } });
    return u;
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
  @Get() list(@Auth() a: AuthCtx) { requireRole(a, ...HR_ROLES, 'BRANCH_MANAGER'); return this.svc.list(a); }
  @Post() create(@Auth() a: AuthCtx, @Body() b: CreateDto) { requireRole(a, ...HR_ROLES); return this.svc.create(a, b); }
  @Put(':id') update(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: UpdateDto) { requireRole(a, ...HR_ROLES); return this.svc.update(a, id, b); }
  @Post(':id/reset-device') reset(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: { reason: string }) { requireRole(a, ...HR_ROLES); return this.svc.resetDevice(a, id, b.reason); }
}
