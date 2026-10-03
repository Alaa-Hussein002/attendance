import { describe, it, expect } from 'vitest';
import { calculateMonth, DEFAULT_POLICY } from '@attendance/shared';
import { csvCell, effectiveAsOf, summarize, toCsv } from './payroll';

describe('payroll', () => {
  it('summarizes: net = base - deductions + bonus', () => {
    const r = calculateMonth({ year: 2026, month: 3, baseSalary: 300000, policy: DEFAULT_POLICY, asOfDate: '2026-03-01',
      records: [{ date: '2026-03-01', checkInMinutes: 650 }] });
    const row = summarize('u1', 'Ali', 300000, r);
    expect(row).toMatchObject({ lateDays: 1, onTimeDays: 0, lateDeductionsMinor: 5000, netSalaryMinor: 295000 });
  });
  it('perfect month adds bonus', () => {
    const recs = Array.from({ length: 31 }, (_, i) => ({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, checkInMinutes: 595 }));
    const row = summarize('u1', 'Ali', 300000, calculateMonth({ year: 2026, month: 3, baseSalary: 300000, policy: DEFAULT_POLICY, records: recs }));
    expect(row.netSalaryMinor).toBe(330000);
  });
});

describe('effectiveAsOf', () => {
  const now = (minutes: number) => ({ date: '2026-03-10', minutes });
  it('morning, not checked in yet => yesterday', () => expect(effectiveAsOf(now(540), DEFAULT_POLICY, false)).toBe('2026-03-09'));
  it('morning, already checked in => today', () => expect(effectiveAsOf(now(540), DEFAULT_POLICY, true)).toBe('2026-03-10'));
  it('after last window closed => today', () => expect(effectiveAsOf(now(721), DEFAULT_POLICY, false)).toBe('2026-03-10'));
  it('exactly at last window => still yesterday', () => expect(effectiveAsOf(now(720), DEFAULT_POLICY, false)).toBe('2026-03-09'));
});

describe('csv', () => {
  it('neutralizes formula injection', () => expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`));
  it('guards + - @', () => { expect(csvCell('+1')).toBe("'+1"); expect(csvCell('@a')).toBe("'@a"); expect(csvCell('-1')).toBe("'-1"); });
  it('quotes commas and newlines', () => { expect(csvCell('a,b')).toBe('"a,b"'); expect(csvCell('a\nb')).toBe('"a\nb"'); });
  it('has BOM and formats money', () => {
    const csv = toCsv([{ userId: 'u', name: 'Ali', baseSalaryMinor: 300000, onTimeDays: 1, lateDays: 0, absentDays: 0, redeemedDays: 0,
      lateDeductionsMinor: 0, absentDeductionsMinor: 0, bonusMinor: 30000, netSalaryMinor: 330000 }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Ali,3000.00,1,0,0,0,0.00,0.00,300.00,3300.00');
  });
});
