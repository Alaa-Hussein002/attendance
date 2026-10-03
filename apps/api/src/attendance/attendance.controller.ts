import { Body, Controller, Delete, Ip, Post } from '@nestjs/common';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { HR_ROLES } from '../common/http';
import { AttendanceService, CheckInDto } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private svc: AttendanceService) {}
  @Post('check-in') checkIn(@Auth() a: AuthCtx, @Ip() ip: string, @Body() dto: CheckInDto) {
    return this.svc.checkIn(a.companyId, a.userId, ip, dto);
  }
  @Post('excuse') excuse(@Auth() a: AuthCtx, @Body() b: { userId: string; date: string; reason: string }) { requireRole(a, ...HR_ROLES); return this.svc.excuse(a, b); }
  @Delete('excuse') unexcuse(@Auth() a: AuthCtx, @Body() b: { userId: string; date: string; reason: string }) { requireRole(a, ...HR_ROLES); return this.svc.removeExcuse(a, b.userId, b.date, b.reason); }
  @Post('manual') manual(@Auth() a: AuthCtx, @Body() b: { userId: string; date: string; time: string; reason: string }) { requireRole(a, ...HR_ROLES); return this.svc.manual(a, b); }
}
