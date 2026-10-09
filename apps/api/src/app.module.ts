import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './common/prisma.service';
import { PoliciesController } from './policies/policies.controller';
import { PoliciesService } from './policies/policies.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt.guard';
import { EmailOtpSender, OtpSender } from './auth/otp-sender';
import { MailService } from './common/mail.service';
import { SetupController, SetupService } from './setup/setup.controller';
import { ExcuseRequestsController, ExcuseRequestsService } from './excuse-requests/excuse-requests.controller';
import { DevicesController, DevicesService } from './devices/devices.controller';
import { TasksController, TasksService } from './tasks/tasks.controller';
import { AgentController } from './agent/agent.controller';
import { AgentService } from './agent/agent.service';
import { NotificationService } from './notifications/notification.service';
import { RemindersService } from './notifications/reminders.service';
import { WhatsappService } from './notifications/whatsapp.service';
import { WhatsappAdminService, WhatsappController } from './notifications/whatsapp.controller';

import { BranchesController, BranchesService } from './branches/branches.controller';
import { EmployeesController, EmployeesService } from './employees/employees.controller';
import { HolidaysController, HolidaysService } from './holidays/holidays.controller';
import { LeavesController, LeavesService } from './leaves/leaves.controller';
import { ReportsController, ReportsService } from './reports/reports.controller';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set (min 32 chars)');

@Module({
  imports: [ScheduleModule.forRoot(), JwtModule.register({ secret, signOptions: { expiresIn: '15m' } })],
  controllers: [AuthController, PoliciesController, AttendanceController, BranchesController, EmployeesController, HolidaysController, LeavesController, ReportsController, SetupController, ExcuseRequestsController, DevicesController, TasksController, AgentController, WhatsappController],
  providers: [PrismaService, PoliciesService, AttendanceService, AuthService, BranchesService, EmployeesService, HolidaysService, LeavesService, ReportsService, MailService, SetupService, ExcuseRequestsService, DevicesService, TasksService, AgentService, NotificationService, RemindersService, WhatsappService, WhatsappAdminService,
    { provide: OtpSender, useClass: EmailOtpSender },
    { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
