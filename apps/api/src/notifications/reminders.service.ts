import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { digestDue, localToUtc, nextDay, reminderDue, toLocalParts } from '@attendance/shared';
import { PrismaService } from '../common/prisma.service';
import { NotificationService } from './notification.service';

/** Runs every minute: the hour-before reminders and the 07:00 morning digest. Idempotent through NotificationLog. */
@Injectable()
export class RemindersService {
  private log = new Logger('Reminders'); private running = false;
  constructor(private prisma: PrismaService, private notify: NotificationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running || process.env.DISABLE_SCHEDULER === 'true') return; this.running = true;
    try { await this.runOnce(new Date()); } catch (e: any) { this.log.error(`tick failed: ${e?.message}`); } finally { this.running = false; }
  }

  async runOnce(now: Date) {
    const soon = await this.prisma.task.findMany({ where: { status: 'SCHEDULED', startsAt: { gt: now, lte: new Date(now.getTime() + 61 * 60000) } }, include: { assignees: { include: { user: true } } } });
    for (const t of soon) if (reminderDue(t, now)) for (const a of t.assignees) if (a.user.active) await this.notify.reminder(t, a.user);

    for (const c of await this.prisma.company.findMany()) {
      const local = toLocalParts(now, c.timezone); if (!digestDue(local.minutes)) continue;
      const rows = await this.prisma.task.findMany({ where: { companyId: c.id, status: 'SCHEDULED', startsAt: { gte: localToUtc(local.date, '00:00', c.timezone), lt: localToUtc(nextDay(local.date), '00:00', c.timezone) } },
        include: { assignees: { include: { user: true } } }, orderBy: { startsAt: 'asc' } });
      const byUser = new Map<string, { user: any; tasks: any[] }>();
      for (const t of rows) for (const a of t.assignees) { if (!a.user.active) continue; const e = byUser.get(a.userId) ?? { user: a.user, tasks: [] }; e.tasks.push(t); byUser.set(a.userId, e); }
      for (const { user, tasks } of byUser.values()) await this.notify.dailyDigest(c.id, user, tasks, local.date);
    }
  }
}
