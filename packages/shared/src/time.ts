/** Convert an instant to the company's local date (YYYY-MM-DD) and minutes since local midnight. */
export function toLocalParts(instant: Date, timeZone = 'Asia/Riyadh') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** All dates YYYY-MM-DD from..to inclusive (max 400 days, guards against abuse). */
export function expandDateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const a = new Date(`${from}T00:00:00Z`), b = new Date(`${to}T00:00:00Z`);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) return out;
  for (let d = a; d <= b && out.length < 400; d = new Date(d.getTime() + 86400000)) out.push(d.toISOString().slice(0, 10));
  return out;
}
export const prevDay = (date: string) => new Date(new Date(`${date}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
export const monthBounds = (year: number, month: number) =>
  ({ from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(new Date(Date.UTC(year, month, 0)).getUTCDate())}` });

/** Local wall-clock (date + "HH:mm") in a timezone -> UTC instant. */
export function localToUtc(date: string, hhmm: string, timeZone = 'Asia/Riyadh'): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const target = Date.UTC(y, m - 1, d, h, mi);
  let guess = target;
  for (let i = 0; i < 2; i++) { // converge (handles DST)
    const p = toLocalParts(new Date(guess), timeZone);
    const [py, pm, pd] = p.date.split('-').map(Number);
    const shown = Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60);
    guess += target - shown;
  }
  return new Date(guess);
}

/**
 * Payroll period of a "month". startDay=1 => the calendar month.
 * startDay=25 => from the 25th of the PREVIOUS month to the 24th of this month
 * (the period is named after the month in which it ends).
 */
export function periodBounds(year: number, month: number, startDay = 1) {
  if (startDay <= 1) return monthBounds(year, month);
  const py = month === 1 ? year - 1 : year;
  const pm = month === 1 ? 12 : month - 1;
  return { from: `${py}-${pad2(pm)}-${pad2(startDay)}`, to: `${year}-${pad2(month)}-${pad2(startDay - 1)}` };
}
/** The payroll month (year, month) that a calendar date belongs to, for a given start day. */
export function periodOf(date: string, startDay = 1) {
  let [y, m, d] = date.split('-').map(Number);
  if (startDay > 1 && d >= startDay) { m += 1; if (m === 13) { m = 1; y += 1; } }
  return { year: y, month: m };
}

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
/** "الثلاثاء 6 أكتوبر" — Gregorian, Latin digits. */
export const fmtDayAr = (iso: string) => `${DAYS_AR[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${Number(iso.slice(8))} ${MONTHS_AR[Number(iso.slice(5, 7)) - 1]}`;
/** minutes since midnight or "HH:mm" -> "2:30 م" */
export function fmtTime12Ar(v: number | string) { const m = typeof v === 'number' ? v : hhmmToMinutes(v); const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; }
export const nextDay = (date: string) => new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
