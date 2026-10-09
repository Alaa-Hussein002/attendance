import { Injectable, Logger } from '@nestjs/common';
import { toLocalParts } from '@attendance/shared';
import { MailService } from '../common/mail.service';
import { PrismaService } from '../common/prisma.service';
import { renderTaskEmail, TaskLine, taskSummary } from './task-email';
import { WaKind, WhatsappService } from './whatsapp.service';

type U = { id: string; name: string; email: string; phone: string | null };
interface Content { kind: string; refKey: string; wa: WaKind; headline: string; intro: string; tasks: TaskLine[] }

export const lineOf = (t: any, tz: string): TaskLine => { const s = toLocalParts(t.startsAt, tz), e = toLocalParts(t.endsAt, tz);
  return { title: t.title, date: s.date, startMinutes: s.minutes, endMinutes: e.minutes, address: t.address, details: t.details, lat: Number(t.latitude), lng: Number(t.longitude) }; };

@Injectable()
export class NotificationService {
  private log = new Logger('Notify');
  constructor(private prisma: PrismaService, private mail: MailService, private wa: WhatsappService) {}

  /** Insert-first makes every message idempotent: a second attempt hits the unique key and is skipped. */
  private async once(companyId: string, userId: string, kind: string, refKey: string, channel: 'EMAIL' | 'WHATSAPP', fn: () => Promise<unknown>) {
    let row: { id: string };
    try { row = await this.prisma.notificationLog.create({ data: { companyId, userId, kind, refKey, channel, status: 'PENDING' } }); }
    catch (e: any) { if (e?.code === 'P2002') return; throw e; }
    try { const r: any = await fn(); await this.prisma.notificationLog.update({ where: { id: row.id }, data: { status: r?.skipped ? 'SKIPPED' : 'SENT' } }); }
    catch (e: any) { this.log.warn(`${channel} ${kind} failed: ${e?.message}`); await this.prisma.notificationLog.update({ where: { id: row.id }, data: { status: 'FAILED', error: String(e?.message ?? e).slice(0, 300) } }); }
  }

  async deliver(companyId: string, user: U, c: Content) {
    const { subject, html, text } = renderTaskEmail({ name: user.name, headline: c.headline, intro: c.intro, tasks: c.tasks });
    await this.once(companyId, user.id, c.kind, c.refKey, 'EMAIL', () => this.mail.send({ to: user.email, subject, html, text }));
    if (user.phone && (await this.wa.ready(companyId, c.wa))) {
      const params = [user.name, c.tasks.map(taskSummary).join(' | ')];
      await this.once(companyId, user.id, c.kind, c.refKey, 'WHATSAPP', () => this.wa.send(companyId, user.phone!, c.wa, params));
    }
  }

  private async tz(companyId: string) { return (await this.prisma.company.findUnique({ where: { id: companyId } }))!.timezone; }
  private async users(ids: string[]) { return this.prisma.user.findMany({ where: { id: { in: ids }, active: true } }); }

  async taskAssigned(task: any, userIds: string[], updated = false) {
    const tz = await this.tz(task.companyId); const line = lineOf(task, tz);
    for (const u of await this.users(userIds)) await this.deliver(task.companyId, u, { kind: updated ? 'UPDATED' : 'ASSIGNED', refKey: `${task.id}:${new Date(task.updatedAt ?? Date.now()).getTime()}`, wa: 'ASSIGNED',
      headline: updated ? 'تم تحديث مهمة' : 'مهمة جديدة لك', intro: updated ? 'تم تعديل المهمة التالية. راجع التفاصيل المحدثة:' : 'تم تكليفك بالمهمة التالية:', tasks: [line] });
  }
  async taskCancelled(task: any, userIds: string[]) {
    const tz = await this.tz(task.companyId); const line = lineOf(task, tz);
    for (const u of await this.users(userIds)) await this.deliver(task.companyId, u, { kind: 'CANCELLED', refKey: task.id, wa: 'ASSIGNED', headline: 'تم إلغاء مهمة', intro: 'أُلغيت المهمة التالية، ولا حاجة لحضورها:', tasks: [line] });
  }
  async reminder(task: any, user: U) {
    const line = lineOf(task, await this.tz(task.companyId));
    await this.deliver(task.companyId, user, { kind: 'REMINDER', refKey: task.id, wa: 'REMINDER', headline: 'تذكير: مهمتك بعد أقل من ساعة', intro: 'تبدأ المهمة التالية قريباً:', tasks: [line] });
  }
  async dailyDigest(companyId: string, user: U, tasks: any[], date: string) {
    const tz = await this.tz(companyId);
    await this.deliver(companyId, user, { kind: 'DAILY', refKey: date, wa: 'DAILY', headline: tasks.length === 1 ? 'لديك مهمة اليوم' : `لديك ${tasks.length} مهام اليوم`, intro: 'هذه مهامك وحجوزاتك لهذا اليوم:', tasks: tasks.map((t) => lineOf(t, tz)) });
  }
}
