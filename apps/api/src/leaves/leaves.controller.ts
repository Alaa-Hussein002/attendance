import { Body, Controller, Get, Injectable, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { expandDateRange } from '@attendance/shared';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { check, DATE_RE, HR_ROLES } from '../common/http';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  async request(a: AuthCtx, d: { fromDate: string; toDate: string; reason?: string }) {
    check(DATE_RE.test(d.fromDate ?? '') && DATE_RE.test(d.toDate ?? ''), 'INVALID_DATE');
    const days = expandDateRange(d.fromDate, d.toDate);
    check(days.length > 0 && days.length <= 60, 'INVALID_RANGE');
    const overlap = await this.prisma.leaveRequest.count({ where: { userId: a.userId, companyId: a.companyId,
      status: { in: ['PENDING', 'APPROVED'] }, fromDate: { lte: d.toDate }, toDate: { gte: d.fromDate } } });
    check(overlap === 0, 'LEAVE_OVERLAP');
    return this.prisma.leaveRequest.create({ data: { companyId: a.companyId, userId: a.userId, fromDate: d.fromDate, toDate: d.toDate, reason: d.reason?.slice(0, 500) } });
  }
  list(a: AuthCtx, status?: string) {
    const where: any = { companyId: a.companyId };
    if (!HR_ROLES.includes(a.role)) where.userId = a.userId; // employees see only their own
    if (status) where.status = status;
    return this.prisma.leaveRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
  async decide(a: AuthCtx, id: string, approve: boolean) {
    const row = await this.prisma.leaveRequest.findFirst({ where: { id, companyId: a.companyId } });
    if (!row) throw new NotFoundException('LEAVE_NOT_FOUND');
    check(row.status === 'PENDING', 'ALREADY_DECIDED');
    const upd = await this.prisma.leaveRequest.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: a.userId, decidedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: approve ? 'LEAVE_APPROVE' : 'LEAVE_REJECT', entity: 'LeaveRequest', entityId: id, before: row as any, after: upd as any } });
    return upd;
  }
}

@Controller('leaves')
export class LeavesController {
  constructor(private svc: LeavesService) {}
  @Post() request(@Auth() a: AuthCtx, @Body() b: { fromDate: string; toDate: string; reason?: string }) { return this.svc.request(a, b); }
  @Get() list(@Auth() a: AuthCtx, @Query('status') s?: string) { return this.svc.list(a, s); }
  @Post(':id/decision') decide(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: { approve: boolean }) { requireRole(a, ...HR_ROLES); return this.svc.decide(a, id, !!b.approve); }
}
