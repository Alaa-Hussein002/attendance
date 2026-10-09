import { BadRequestException, Body, Controller, Get, Header, Injectable, NotFoundException, Post, Query, Res } from '@nestjs/common';
import { AttendancePolicy, calculateMonth, expandDateRange, MonthResult, normalizePolicy, periodBounds, toLocalParts } from '@attendance/shared';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { check, HR_ROLES } from '../common/http';
import { toMinor } from '../common/money';
import { PrismaService } from '../common/prisma.service';
import { effectiveAsOf, PayrollRow, summarize, toCsv } from './payroll';

interface Computed { userId: string; name: string; role: string; branchId: string | null; result: MonthResult; row: PayrollRow; policy: AttendancePolicy }

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /** Live computation from raw records; nothing here is trusted from stored summaries. (year, month) = the payroll month. */
  async compute(companyId: string, year: number, month: number, userIds?: string[], branchId?: string): Promise<Computed[]> {
    check(Number.isInteger(year) && year >= 2020 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12, 'INVALID_MONTH');
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('COMPANY_NOT_FOUND');
    const where: any = { companyId, active: true, tracksAttendance: true, role: { not: 'SUPER_ADMIN' } };
    if (userIds) where.id = { in: userIds };
    if (branchId) where.branchId = branchId;
    const users = await this.prisma.user.findMany({ where, include: { branch: true }, orderBy: { name: 'asc' } });
    if (!users.length) return [];
    const ids = users.map((u: any) => u.id);

    const defaultRow = await this.prisma.attendancePolicy.findFirst({ where: { companyId, isDefault: true, active: true } });
    const policyIds = [...new Set(users.flatMap((u: any) => [u.policyId, u.branch?.policyId]).filter(Boolean))] as string[];
    const rows = policyIds.length ? await this.prisma.attendancePolicy.findMany({ where: { companyId, id: { in: policyIds } } }) : [];
    const byId = new Map<string, AttendancePolicy>(rows.map((p: any) => [p.id, normalizePolicy(p.config)]));
    const fallback = defaultRow ? normalizePolicy(defaultRow.config) : null;
    const policyOf = (u: any) => (u.policyId && byId.get(u.policyId)) || (u.branch?.policyId && byId.get(u.branch.policyId)) || fallback;

    // one query window covering every employee's period (policies may use different start days)
    let from = '9999-12-31', to = '0000-01-01';
    for (const u of users as any[]) {
      const p = policyOf(u); if (!p) throw new NotFoundException('POLICY_NOT_CONFIGURED');
      const b = periodBounds(year, month, p.payrollStartDay);
      if (b.from < from) from = b.from; if (b.to > to) to = b.to;
    }
    const [records, holidays, leaves, excuses] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { companyId, userId: { in: ids }, localDate: { gte: from, lte: to } } }),
      this.prisma.holiday.findMany({ where: { companyId, date: { gte: from, lte: to } } }),
      this.prisma.leaveRequest.findMany({ where: { companyId, userId: { in: ids }, status: 'APPROVED', fromDate: { lte: to }, toDate: { gte: from } } }),
      this.prisma.excuse.findMany({ where: { companyId, userId: { in: ids }, localDate: { gte: from, lte: to } } }),
    ]);
    const now = toLocalParts(new Date(), company.timezone);

    return (users as any[]).map((u) => {
      const policy = policyOf(u)!;
      const mine = records.filter((r: any) => r.userId === u.id);
      const result = calculateMonth({
        year, month, baseSalary: toMinor(u.baseSalary), policy,
        records: mine.map((r: any) => ({ date: r.localDate, checkInMinutes: toLocalParts(r.checkInAt, company.timezone).minutes })),
        holidays: holidays.map((h: any) => h.date),
        leaveDays: leaves.filter((l: any) => l.userId === u.id).flatMap((l: any) => expandDateRange(l.fromDate, l.toDate)),
        excusedDays: excuses.filter((e: any) => e.userId === u.id).map((e: any) => e.localDate),
        asOfDate: effectiveAsOf(now, policy, mine.some((r: any) => r.localDate === now.date)),
      });
      return { userId: u.id, name: u.name, role: u.role, branchId: u.branchId, result, row: summarize(u.id, u.name, toMinor(u.baseSalary), result), policy };
    });
  }

  /** Persist immutable snapshots (with the exact policy used) once the payroll period is over. HR may re-run to recompute. */
  async close(a: AuthCtx, year: number, month: number) {
    const company = await this.prisma.company.findUnique({ where: { id: a.companyId } });
    const defaultRow = await this.prisma.attendancePolicy.findFirst({ where: { companyId: a.companyId, isDefault: true, active: true } });
    const startDay = defaultRow ? normalizePolicy(defaultRow.config).payrollStartDay : 1;
    const { from, to } = periodBounds(year, month, startDay);
    const today = toLocalParts(new Date(), company!.timezone).date;
    if (!(today > to)) throw new BadRequestException({ code: 'PERIOD_NOT_FINISHED', periodFrom: from, periodEnd: to, today });
    const all = await this.compute(a.companyId, year, month);
    for (const c of all) {
      const data = { companyId: a.companyId, userId: c.userId, year, month, policyConfig: c.policy as any, snapshot: { result: c.result, row: c.row } as any, computedAt: new Date() };
      await this.prisma.monthlySummary.upsert({ where: { userId_year_month: { userId: c.userId, year, month } }, create: data, update: data });
    }
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'MONTH_CLOSE', entity: 'MonthlySummary', entityId: `${year}-${month}`, after: { employees: all.length } as any } });
    return { closed: all.length };
  }
}

@Controller()
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Get('reports/monthly') async monthly(@Auth() a: AuthCtx, @Query('year') y: string, @Query('month') m: string, @Query('userId') userId?: string, @Query('branchId') branchId?: string) {
    requireRole(a, ...HR_ROLES);
    return this.svc.compute(a.companyId, Number(y), Number(m), userId ? [userId] : undefined, branchId);
  }

  @Get('reports/payroll.csv') @Header('Content-Type', 'text/csv; charset=utf-8') @Header('Cache-Control', 'no-store')
  async payroll(@Auth() a: AuthCtx, @Query('year') y: string, @Query('month') m: string, @Res({ passthrough: true }) res: any) {
    requireRole(a, ...HR_ROLES);
    const rows = (await this.svc.compute(a.companyId, Number(y), Number(m))).map((c) => c.row);
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${Number(y)}-${String(Number(m)).padStart(2, '0')}.csv"`);
    return toCsv(rows);
  }

  @Post('reports/close') close(@Auth() a: AuthCtx, @Body() b: { year: number; month: number }) { requireRole(a, ...HR_ROLES); return this.svc.close(a, b.year, b.month); }

  /** The employee's own live points for a payroll month. */
  @Get('me/month') async me(@Auth() a: AuthCtx, @Query('year') y: string, @Query('month') m: string) {
    const [c] = await this.svc.compute(a.companyId, Number(y), Number(m), [a.userId]);
    return c ?? { error: 'NOT_AN_EMPLOYEE' };
  }
}
