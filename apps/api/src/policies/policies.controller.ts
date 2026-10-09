import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { AttendancePolicy } from '@attendance/shared';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { PoliciesService } from './policies.service';

import { ADMIN_ONLY } from '../common/http';
const HR_ROLES = ['HR', 'COMPANY_ADMIN'];

@Controller('policies')
export class PoliciesController {
  constructor(private svc: PoliciesService) {}

  @Get() list(@Auth() a: AuthCtx) { requireRole(a, ...HR_ROLES, 'BRANCH_MANAGER'); return this.svc.list(a.companyId); }

  @Post('validate') validate(@Auth() a: AuthCtx, @Body() b: { config: AttendancePolicy }) {
    requireRole(a, ...ADMIN_ONLY); return this.svc.validate(b.config);
  }
  @Post() create(@Auth() a: AuthCtx, @Body() b: { name: string; config: AttendancePolicy; effectiveFrom: string; isDefault?: boolean }) {
    requireRole(a, ...ADMIN_ONLY);
    return this.svc.create(a.companyId, a.userId, b.name, b.config, b.effectiveFrom, !!b.isDefault);
  }
  @Put(':id') update(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: { config: AttendancePolicy; effectiveFrom: string }) {
    requireRole(a, ...ADMIN_ONLY);
    return this.svc.newVersion(a.companyId, a.userId, id, b.config, b.effectiveFrom);
  }
}
