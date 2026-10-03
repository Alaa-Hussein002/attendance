import { Body, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { check, DATE_RE, HR_ROLES } from '../common/http';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}
  list(companyId: string, year?: string) {
    const where: any = { companyId };
    if (year) where.date = { gte: `${year}-01-01`, lte: `${year}-12-31` };
    return this.prisma.holiday.findMany({ where, orderBy: { date: 'asc' } });
  }
  async create(a: AuthCtx, date: string, name: string) {
    check(DATE_RE.test(date ?? ''), 'INVALID_DATE'); check(name?.trim(), 'NAME_REQUIRED');
    check(!(await this.prisma.holiday.findFirst({ where: { companyId: a.companyId, date } })), 'HOLIDAY_EXISTS');
    const row = await this.prisma.holiday.create({ data: { companyId: a.companyId, date, name: name.trim() } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'HOLIDAY_CREATE', entity: 'Holiday', entityId: row.id, after: row as any } });
    return row;
  }
  async remove(a: AuthCtx, id: string) {
    const row = await this.prisma.holiday.findFirst({ where: { id, companyId: a.companyId } });
    if (!row) throw new NotFoundException('HOLIDAY_NOT_FOUND');
    await this.prisma.holiday.delete({ where: { id } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'HOLIDAY_DELETE', entity: 'Holiday', entityId: id, before: row as any } });
    return { ok: true };
  }
}

@Controller('holidays')
export class HolidaysController {
  constructor(private svc: HolidaysService) {}
  @Get() list(@Auth() a: AuthCtx, @Query('year') year?: string) { return this.svc.list(a.companyId, year); }
  @Post() create(@Auth() a: AuthCtx, @Body() b: { date: string; name: string }) { requireRole(a, ...HR_ROLES); return this.svc.create(a, b.date, b.name); }
  @Delete(':id') remove(@Auth() a: AuthCtx, @Param('id') id: string) { requireRole(a, ...HR_ROLES); return this.svc.remove(a, id); }
}
