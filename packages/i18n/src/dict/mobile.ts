import type { MsgValue } from '../types';

/**
 * Wording for the employee app (apps/mobile). Owned by the mobile surface; shared vocabulary lives in
 * dict/common.ts (common.*, role.*, outcome.*, err.*, month.*, day.*, neutral.*).
 */
export const en = {
  'm.app.title': 'Bayt Al Mosawer',
  'm.app.tagline': 'Attendance and payroll for studios',
} as const;

export type MobileDict = typeof en;

export const ar: { [K in keyof MobileDict]: MsgValue } = {
  'm.app.title': 'بيت المصور',
  'm.app.tagline': 'الحضور والرواتب للمصاور',
};
