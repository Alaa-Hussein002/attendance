import { Body, Controller, Get, Injectable, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { isValidIpRange } from '@attendance/shared';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { check, HR_ROLES } from '../common/http';
import { PrismaService } from '../common/prisma.service';

interface BranchDto { name: string; latitude?: number; longitude?: number; radiusMeters?: number;
  allowedIpRanges?: string[]; verificationModes: string[]; policyId?: string | null }

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}
  private validate(b: BranchDto) {
    check(b.name?.trim(), 'NAME_REQUIRED');
    const modes = b.verificationModes ?? [];
    check(modes.length && modes.every((m) => ['GPS', 'NETWORK', 'FINGERPRINT'].includes(m)), 'INVALID_MODES');
    if (b.latitude !== undefined) check(b.latitude >= -90 && b.latitude <= 90, 'INVALID_LATITUDE');
    if (b.longitude !== undefined) check(b.longitude >= -180 && b.longitude <= 180, 'INVALID_LONGITUDE');
    if (b.radiusMeters !== undefined) check(Number.isInteger(b.radiusMeters) && b.radiusMeters >= 10 && b.radiusMeters <= 5000, 'INVALID_RADIUS');
    const ranges = b.allowedIpRanges ?? [];
    check(ranges.every(isValidIpRange), 'INVALID_IP_RANGE');
    if (modes.includes('GPS')) check(b.latitude !== undefined && b.longitude !== undefined && b.radiusMeters !== undefined, 'GPS_NEEDS_LOCATION');
    if (modes.includes('NETWORK')) check(ranges.length > 0, 'NETWORK_NEEDS_IP_RANGE');
  }
  private async checkPolicy(companyId: string, policyId?: string | null) {
    if (policyId) check(await this.prisma.attendancePolicy.findFirst({ where: { id: policyId, companyId } }), 'POLICY_NOT_FOUND');
  }
  list(companyId: string) { return this.prisma.branch.findMany({ where: { companyId }, orderBy: { name: 'asc' } }); }
  async create(a: AuthCtx, b: BranchDto) {
    this.validate(b); await this.checkPolicy(a.companyId, b.policyId);
    const row = await this.prisma.branch.create({ data: { companyId: a.companyId, name: b.name.trim(), latitude: b.latitude, longitude: b.longitude,
      radiusMeters: b.radiusMeters, allowedIpRanges: b.allowedIpRanges ?? [], verificationModes: b.verificationModes as any, policyId: b.policyId ?? null } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'BRANCH_CREATE', entity: 'Branch', entityId: row.id, after: row as any } });
    return row;
  }
  async update(a: AuthCtx, id: string, b: BranchDto) {
    this.validate(b); await this.checkPolicy(a.companyId, b.policyId);
    const before = await this.prisma.branch.findFirst({ where: { id, companyId: a.companyId } });
    if (!before) throw new NotFoundException('BRANCH_NOT_FOUND');
    const row = await this.prisma.branch.update({ where: { id }, data: { name: b.name.trim(), latitude: b.latitude, longitude: b.longitude,
      radiusMeters: b.radiusMeters, allowedIpRanges: b.allowedIpRanges ?? [], verificationModes: b.verificationModes as any, policyId: b.policyId ?? null } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'BRANCH_UPDATE', entity: 'Branch', entityId: id, before: before as any, after: row as any } });
    return row;
  }
}

@Controller('branches')
export class BranchesController {
  constructor(private svc: BranchesService) {}
  @Get() list(@Auth() a: AuthCtx) { requireRole(a, ...HR_ROLES, 'BRANCH_MANAGER'); return this.svc.list(a.companyId); }
  @Post() create(@Auth() a: AuthCtx, @Body() b: BranchDto) { requireRole(a, ...HR_ROLES); return this.svc.create(a, b); }
  @Put(':id') update(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: BranchDto) { requireRole(a, ...HR_ROLES); return this.svc.update(a, id, b); }
}
