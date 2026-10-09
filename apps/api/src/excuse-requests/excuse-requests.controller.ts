import { Body, Controller, Get, Injectable, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { prevDay, toLocalParts } from '@attendance/shared';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { check, DATE_RE, HR_ROLES } from '../common/http';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';

const MAX_BACK_DAYS = 31;

@Injectable()
export class ExcuseRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(a: AuthCtx, d: { date: string; reason: string }) {
    check(DATE_RE.test(d.date ?? ''), 'INVALID_DATE');
    check(d.reason?.trim().length >= 3, 'REASON_REQUIRED');
    const company = await this.prisma.company.findUnique({ where: { id: a.companyId } });
    let limit = toLocalParts(new Date(), company!.timezone).date;
    check(d.date <= limit, 'DATE_IN_FUTURE');
    for (let i = 0; i < MAX_BACK_DAYS; i++) limit = prevDay(limit);
    check(d.date >= limit, 'DATE_TOO_OLD');
    check(!(await this.prisma.excuseRequest.findFirst({ where: { userId: a.userId, localDate: d.date, status: { in: ['PENDING', 'APPROVED'] } } })), 'REQUEST_EXISTS');
    return this.prisma.excuseRequest.create({ data: { companyId: a.companyId, userId: a.userId, localDate: d.date, reason: d.reason.trim().slice(0, 500) } });
  }

  list(a: AuthCtx, status?: string) {
    const where: any = { companyId: a.companyId };
    if (!HR_ROLES.includes(a.role)) where.userId = a.userId; // employees only see their own
    if (status) where.status = status;
    return this.prisma.excuseRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  /** Approving turns the request into a real Excuse, which neutralizes the day in the points engine. */
  async decide(a: AuthCtx, id: string, approve: boolean, note?: string) {
    const row = await this.prisma.excuseRequest.findFirst({ where: { id, companyId: a.companyId } });
    if (!row) throw new NotFoundException('REQUEST_NOT_FOUND');
    check(row.status === 'PENDING', 'ALREADY_DECIDED');
    const upd = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const u = await tx.excuseRequest.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: a.userId, decidedAt: new Date(), decisionNote: note?.slice(0, 300) } });
      if (approve) await tx.excuse.upsert({ where: { userId_localDate: { userId: row.userId, localDate: row.localDate } },
        create: { companyId: a.companyId, userId: row.userId, localDate: row.localDate, reason: row.reason, createdById: a.userId }, update: { reason: row.reason, createdById: a.userId } });
      await tx.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: approve ? 'EXCUSE_REQUEST_APPROVE' : 'EXCUSE_REQUEST_REJECT', entity: 'ExcuseRequest', entityId: id, before: row as any, after: u as any } });
      return u;
    });
    return upd;
  }
}

@Controller('excuse-requests')
export class ExcuseRequestsController {
  constructor(private svc: ExcuseRequestsService) {}
  @Post() create(@Auth() a: AuthCtx, @Body() b: { date: string; reason: string }) { return this.svc.create(a, b); }
  @Get() list(@Auth() a: AuthCtx, @Query('status') s?: string) { return this.svc.list(a, s); }
  @Post(':id/decision') decide(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: { approve: boolean; note?: string }) { requireRole(a, ...HR_ROLES); return this.svc.decide(a, id, !!b.approve, b.note); }
}
