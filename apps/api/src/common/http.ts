import { BadRequestException } from '@nestjs/common';
export const check = (cond: unknown, code: string) => { if (!cond) throw new BadRequestException(code); };
export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const HR_ROLES = ['HR', 'COMPANY_ADMIN'];

/** Administrative areas (settings, branches, devices, WhatsApp, holidays) belong to the admin only. */
export const ADMIN_ONLY = ['COMPANY_ADMIN', 'SUPER_ADMIN'];
/** Who may create and manage tasks (bookings). */
export const TASK_ROLES = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR', 'TEAM_LEAD'];
