import { Body, Controller, Get, Header, Injectable, NotFoundException, Post, Query, Res } from '@nestjs/common';
import { AttendancePolicy, calculateMonth, expandDateRange, monthBounds, toLocalParts, MonthResult } from '@attendance/shared';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { check, HR_ROLES } from '../common/http';
import { toMinor } from '../common/money';
import { PrismaService } from '../common/prisma.service';
import { effectiveAsOf, PayrollRow, summarize, toCsv } from './payroll';

interface Computed { userId: string; name: string; result: MonthResult; row: PayrollRow; policy: AttendancePolicy }

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /** Live computation from raw records; nothing here is trusted from stored summaries. */
  async compute(companyId: string, year: number, month: number, userIds?: string[], branchId?: string): Promise<Computed[]> {
    check(Number.isInteger(year) && year >= 2020 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12, 'INVALID_MONTH');
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('COMPANY_NOT_FOUND');
    const where: any = { companyId, active: true, role: 'EMPLOYEE' };
    if (userIds) where.id = { in: userIds };
    if (branchId) where.branchId = branchId;
    const users = await this.prisma.user.findMany({ where, include: { branch: true }, orderBy: { name: 'asc' } });
    const ids = users.map((u: any) => u.id);
    const { from, to } = monthBounds(year, month);

    const [records, holidays, leaves, excuses, defaultPolicy] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { companyId, userId: { in: ids }, localDate: { gte: from, lte: to } } }),
      this.prisma.holiday.findMany({ where: { companyId, date: { gte: from, lte: to } } }),
      this.prisma.leaveRequest.findMany({ where: { companyId, userId: { in: ids }, status: 'APPROVED', fromDate: { lte: to }, toDate: { gte: from } } }),
      this.prisma.excuse.findMany({ where: { companyId, userId: { in: ids }, localDate: { gte: from, lte: to } } }),
      this.prisma.attendancePolicy.findFirst({ where: { companyId, isDefault: true, active: true } }),
    ]);
    const policyIds = [...new Set(users.flatMap((u: any) => [u.policyId, u.branch?.policyId]).filter(Boolean))] as string[];
    const policyRows = policyIds.length ? await this.prisma.attendancePolicy.findMany({ where: { companyId, id: { in: policyIds } } }) : [];
    const byId = new Map(policyRows.map((p: any) => [p.id, p.config as AttendancePolicy]));
    const now = toLocalParts(new Date(), company.timezone);

    const out: Computed[] = [];
    for (const u of users as any[]) {
      const policy = (u.policyId && byId.get(u.policyId)) || (u.branch?.policyId && byId.get(u.branch.policyId)) || (defaultPolicy?.config as AttendancePolicy | undefined);
      if (!policy) throw new NotFoundException('POLICY_NOT_CONFIGURED');
      const mine = records.filter((r: any) => r.userId === u.id);
      const leaveDays = leaves.filter((l: any) => l.userId === u.id).flatMap((l: any) => expandDateRange(l.fromDate, l.toDate));
      const result = calculateMonth({
        year, month, baseSalary: toMinor(u.baseSalary), policy,
        records: mine.map((r: any) => ({ date: r.localDate, checkInMinutes: toLocalParts(r.checkInAt, company.timezone).minutes })),
        holidays: holidays.map((h: any) => h.date), leaveDays,
        excusedDays: excuses.filter((e: any) => e.userId === u.id).map((e: any) => e.localDate),
        asOfDate: effectiveAsOf(now, policy, mine.some((r: any) => r.localDate === now.date)),
      });
      out.push({ userId: u.id, name: u.name, result, row: summarize(u.id, u.name, toMinor(u.baseSalary), result), policy });
    }
    return out;
  }

  /** Persist immutable snapshots (with the exact policy used) once a month is over. HR may re-run to recompute. */
  async close(a: AuthCtx, year: number, month: number) {
    const company = await this.prisma.company.findUnique({ where: { id: a.companyId } });
    const today = toLocalParts(new Date(), company!.timezone).date;
    check(today > monthBounds(year, month).to, 'MONTH_NOT_FINISHED');
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

  /** The employee's own live points for a month (green/red/black calendar + redemption). */
  @Get('me/month') async me(@Auth() a: AuthCtx, @Query('year') y: string, @Query('month') m: string) {
    const [c] = await this.svc.compute(a.companyId, Number(y), Number(m), [a.userId]);
    return c ?? { error: 'NOT_AN_EMPLOYEE' };
  }
}
