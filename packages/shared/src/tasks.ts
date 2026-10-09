/** Work-assignment (booking) rules shared by the API and the apps. All times are LOCAL company minutes. */
export interface TaskSite { id: string; lat: number; lng: number; radiusMeters: number; startMinutes: number; endMinutes: number }
/** An employee may check in at the task site from one hour before it starts until it ends. */
export const TASK_EARLY_MINUTES = 60;
export const taskWindowOpen = (s: TaskSite, minutes: number) => minutes >= s.startMinutes - TASK_EARLY_MINUTES && minutes <= s.endMinutes;

export interface ReminderTask { id: string; startsAt: Date }
/** Hour-before reminder is due when the task starts within `leadMinutes` and has not started yet. */
export function reminderDue(t: ReminderTask, now: Date, leadMinutes = 60): boolean {
  const ms = t.startsAt.getTime() - now.getTime();
  return ms > 0 && ms <= leadMinutes * 60000;
}
/** The morning digest is sent from 07:00 until noon (so a server restart after 07:00 still delivers it). */
export function digestDue(localMinutes: number, fromHour = 7, untilHour = 12): boolean { return localMinutes >= fromHour * 60 && localMinutes < untilHour * 60; }
