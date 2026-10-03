import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './common/prisma.service';
import { PoliciesController } from './policies/policies.controller';
import { PoliciesService } from './policies/policies.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt.guard';
import { ConsoleOtpSender, OtpSender } from './auth/otp-sender';

import { BranchesController, BranchesService } from './branches/branches.controller';
import { EmployeesController, EmployeesService } from './employees/employees.controller';
import { HolidaysController, HolidaysService } from './holidays/holidays.controller';
import { LeavesController, LeavesService } from './leaves/leaves.controller';
import { ReportsController, ReportsService } from './reports/reports.controller';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set (min 32 chars)');

@Module({
  imports: [JwtModule.register({ secret, signOptions: { expiresIn: '15m' } })],
  controllers: [AuthController, PoliciesController, AttendanceController, BranchesController, EmployeesController, HolidaysController, LeavesController, ReportsController],
  providers: [PrismaService, PoliciesService, AttendanceService, AuthService, BranchesService, EmployeesService, HolidaysService, LeavesService, ReportsService,
    { provide: OtpSender, useClass: ConsoleOtpSender },
    { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
