import { Body, Controller, Get, Injectable, Logger, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { localToUtc, nextDay, toLocalParts } from '@attendance/shared';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { check, DATE_RE, TASK_ROLES } from '../common/http';
import { PrismaService } from '../common/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { Prisma } from '@prisma/client';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
interface TaskDto { title: string; details?: string; latitude: number; longitude: number; radiusMeters?: number; address?: string; date: string; startTime: string; endTime: string; assigneeIds: string[] }

@Injectable()
export class TasksService {
  private log = new Logger('Tasks');
  constructor(private prisma: PrismaService, private notify: NotificationService) {}
  private async tz(companyId: string) { return (await this.prisma.company.findUnique({ where: { id: companyId } }))!.timezone; }

  view(t: any, tz: string) {
    const s = toLocalParts(t.startsAt, tz), e = toLocalParts(t.endsAt, tz);
    return { id: t.id, title: t.title, details: t.details, address: t.address, latitude: Number(t.latitude), longitude: Number(t.longitude), radiusMeters: t.radiusMeters, status: t.status,
      date: s.date, startTime: `${String(Math.floor(s.minutes / 60)).padStart(2, '0')}:${String(s.minutes % 60).padStart(2, '0')}`, endTime: `${String(Math.floor(e.minutes / 60)).padStart(2, '0')}:${String(e.minutes % 60).padStart(2, '0')}`,
      startsAt: t.startsAt, endsAt: t.endsAt, assignees: (t.assignees ?? []).map((a: any) => ({ userId: a.userId, name: a.user?.name })) };
  }

  private async valid(a: AuthCtx, d: TaskDto, tz: string) {
    check(d.title?.trim() && d.title.trim().length <= 120, 'TITLE_REQUIRED');
    check(d.latitude >= -90 && d.latitude <= 90 && d.longitude >= -180 && d.longitude <= 180 && typeof d.latitude === 'number', 'INVALID_LOCATION');
    const radius = d.radiusMeters ?? 150; check(Number.isInteger(radius) && radius >= 30 && radius <= 2000, 'INVALID_RADIUS');
    check(DATE_RE.test(d.date ?? '') && TIME_RE.test(d.startTime ?? '') && TIME_RE.test(d.endTime ?? ''), 'INVALID_TIME');
    const startsAt = localToUtc(d.date, d.startTime, tz), endsAt = localToUtc(d.date, d.endTime, tz); check(endsAt > startsAt, 'END_BEFORE_START');
    const ids = [...new Set(d.assigneeIds ?? [])]; check(ids.length >= 1 && ids.length <= 20, 'ASSIGNEES_REQUIRED');
    const users = await this.prisma.user.findMany({ where: { id: { in: ids }, companyId: a.companyId, active: true, tracksAttendance: true } });
    check(users.length === ids.length, 'ASSIGNEE_NOT_FOUND');
    return { startsAt, endsAt, ids, radius };
  }
  private async conflicts(companyId: string, ids: string[], startsAt: Date, endsAt: Date, exceptId?: string) {
    const rows = await this.prisma.task.findMany({ where: { companyId, status: 'SCHEDULED', ...(exceptId ? { id: { not: exceptId } } : {}), startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, assignees: { some: { userId: { in: ids } } } }, include: { assignees: { include: { user: true } } } });
    return rows.flatMap((t: any) => t.assignees.filter((x: any) => ids.includes(x.userId)).map((x: any) => ({ userId: x.userId, name: x.user.name, taskId: t.id, title: t.title })));
  }
  private fire(p: Promise<unknown>) { p.catch((e) => this.log.warn(`notify failed: ${e?.message}`)); }

  async create(a: AuthCtx, d: TaskDto) {
    const tz = await this.tz(a.companyId); const v = await this.valid(a, d, tz);
    const conflicts = await this.conflicts(a.companyId, v.ids, v.startsAt, v.endsAt);
    const t = await this.prisma.task.create({ data: { companyId: a.companyId, title: d.title.trim(), details: d.details?.trim() || null, latitude: d.latitude, longitude: d.longitude, radiusMeters: v.radius, address: d.address?.trim() || null,
      startsAt: v.startsAt, endsAt: v.endsAt, createdById: a.userId, assignees: { create: v.ids.map((userId) => ({ userId })) } }, include: { assignees: { include: { user: true } } } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'TASK_CREATE', entity: 'Task', entityId: t.id, after: { title: t.title, assignees: v.ids } as any } });
    this.fire(this.notify.taskAssigned(t, v.ids));
    return { task: this.view(t, tz), conflicts };
  }
  async update(a: AuthCtx, id: string, d: TaskDto) {
    const old = await this.prisma.task.findFirst({ where: { id, companyId: a.companyId }, include: { assignees: true } }); if (!old) throw new NotFoundException('TASK_NOT_FOUND');
    check(old.status === 'SCHEDULED', 'TASK_NOT_EDITABLE');
    const tz = await this.tz(a.companyId); const v = await this.valid(a, d, tz);
    const conflicts = await this.conflicts(a.companyId, v.ids, v.startsAt, v.endsAt, id);
    const oldIds = old.assignees.map((x: any) => x.userId); const removed = oldIds.filter((x: string) => !v.ids.includes(x)); const added = v.ids.filter((x) => !oldIds.includes(x));
    const t = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.taskAssignee.deleteMany({ where: { taskId: id, userId: { in: removed } } });
      await tx.taskAssignee.createMany({ data: added.map((userId) => ({ taskId: id, userId })), skipDuplicates: true });
      return tx.task.update({ where: { id }, data: { title: d.title.trim(), details: d.details?.trim() || null, latitude: d.latitude, longitude: d.longitude, radiusMeters: v.radius, address: d.address?.trim() || null, startsAt: v.startsAt, endsAt: v.endsAt }, include: { assignees: { include: { user: true } } } });
    });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'TASK_UPDATE', entity: 'Task', entityId: id, before: { title: old.title, startsAt: old.startsAt } as any, after: { title: t.title, startsAt: t.startsAt } as any } });
    this.fire(this.notify.taskAssigned(t, added, false)); this.fire(this.notify.taskAssigned(t, v.ids.filter((x) => !added.includes(x)), true)); if (removed.length) this.fire(this.notify.taskCancelled(t, removed));
    return { task: this.view(t, tz), conflicts };
  }
  async cancel(a: AuthCtx, id: string) {
    const t = await this.prisma.task.findFirst({ where: { id, companyId: a.companyId }, include: { assignees: { include: { user: true } } } }); if (!t) throw new NotFoundException('TASK_NOT_FOUND');
    check(t.status === 'SCHEDULED', 'TASK_NOT_EDITABLE');
    await this.prisma.task.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'TASK_CANCEL', entity: 'Task', entityId: id } });
    this.fire(this.notify.taskCancelled(t, t.assignees.map((x: any) => x.userId)));
    return { ok: true };
  }

  /** Tasks whose local date falls in [from, to]. */
  async list(a: AuthCtx, from: string, to: string, userId?: string) {
    check(DATE_RE.test(from ?? '') && DATE_RE.test(to ?? '') && from <= to, 'INVALID_RANGE');
    const tz = await this.tz(a.companyId);
    const rows = await this.prisma.task.findMany({ where: { companyId: a.companyId, startsAt: { gte: localToUtc(from, '00:00', tz), lt: localToUtc(nextDay(to), '00:00', tz) }, ...(userId ? { assignees: { some: { userId } } } : {}) },
      include: { assignees: { include: { user: true } } }, orderBy: { startsAt: 'asc' }, take: 500 });
    return rows.map((t: any) => this.view(t, tz));
  }
  /** The employee's own tasks in a calendar month (previous / current / next are all just different months). */
  async mine(a: AuthCtx, year: number, month: number) {
    check(Number.isInteger(year) && year >= 2020 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12, 'INVALID_MONTH');
    const m = String(month).padStart(2, '0'); const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return this.list({ ...a, role: 'EMPLOYEE' }, `${year}-${m}-01`, `${year}-${m}-${String(last).padStart(2, '0')}`, a.userId);
  }
}

@Controller('tasks')
export class TasksController {
  constructor(private svc: TasksService) {}
  @Get('mine') mine(@Auth() a: AuthCtx, @Query('year') y: string, @Query('month') m: string) { return this.svc.mine(a, Number(y), Number(m)); }
  @Get() list(@Auth() a: AuthCtx, @Query('from') from: string, @Query('to') to: string, @Query('userId') userId?: string) { requireRole(a, ...TASK_ROLES); return this.svc.list(a, from, to, userId); }
  @Post() create(@Auth() a: AuthCtx, @Body() b: TaskDto) { requireRole(a, ...TASK_ROLES); return this.svc.create(a, b); }
  @Put(':id') update(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: TaskDto) { requireRole(a, ...TASK_ROLES); return this.svc.update(a, id, b); }
  @Post(':id/cancel') cancel(@Auth() a: AuthCtx, @Param('id') id: string) { requireRole(a, ...TASK_ROLES); return this.svc.cancel(a, id); }
}
