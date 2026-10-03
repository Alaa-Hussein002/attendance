import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendancePolicy, validatePolicy } from '@attendance/shared';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PoliciesService {
  constructor(private prisma: PrismaService) {}

  private assertValid(config: AttendancePolicy) {
    const errors = validatePolicy(config);
    if (errors.length) throw new BadRequestException({ code: 'INVALID_POLICY', errors });
  }
  validate(config: AttendancePolicy) { return { valid: validatePolicy(config).length === 0, errors: validatePolicy(config) }; }

  list(companyId: string) {
    return this.prisma.attendancePolicy.findMany({ where: { companyId, active: true }, orderBy: { createdAt: 'desc' } });
  }

  async create(companyId: string, userId: string, name: string, config: AttendancePolicy, effectiveFrom: string, isDefault: boolean) {
    this.assertValid(config);
    return this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.attendancePolicy.updateMany({ where: { companyId, isDefault: true }, data: { isDefault: false } });
      const row = await tx.attendancePolicy.create({ data: { companyId, name, config: config as any, effectiveFrom, isDefault, createdById: userId } });
      await tx.auditLog.create({ data: { companyId, actorId: userId, action: 'POLICY_CREATE', entity: 'AttendancePolicy', entityId: row.id, after: config as any } });
      return row;
    });
  }

  /** Editing NEVER mutates: it creates a new version so past months stay reproducible. */
  async newVersion(companyId: string, userId: string, id: string, config: AttendancePolicy, effectiveFrom: string) {
    this.assertValid(config);
    const old = await this.prisma.attendancePolicy.findFirst({ where: { id, companyId } });
    if (!old) throw new NotFoundException('POLICY_NOT_FOUND');
    return this.prisma.$transaction(async (tx) => {
      await tx.attendancePolicy.update({ where: { id }, data: { active: false, isDefault: false } });
      const row = await tx.attendancePolicy.create({ data: {
        companyId, name: old.name, version: old.version + 1, config: config as any, effectiveFrom,
        isDefault: old.isDefault, createdById: userId } });
      await tx.auditLog.create({ data: { companyId, actorId: userId, action: 'POLICY_NEW_VERSION', entity: 'AttendancePolicy',
        entityId: row.id, before: old.config as any, after: config as any } });
      return row;
    });
  }
}
