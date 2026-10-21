import { Body, Controller, Get, Post } from '@nestjs/common';
import { PLANS } from '@attendance/shared';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { ADMIN_ONLY } from '../common/http';
import { LicenseService } from './license.service';

@Controller('license')
export class LicenseController {
  constructor(private svc: LicenseService) {}
  @Get() async get(@Auth() a: AuthCtx) { requireRole(a, ...ADMIN_ONLY); return { ...(await this.svc.status(true)), plans: PLANS }; }
  @Post('activate') activate(@Auth() a: AuthCtx, @Body() b: { key: string }) { requireRole(a, ...ADMIN_ONLY); return this.svc.activate(a, String(b?.key ?? '')); }
}
