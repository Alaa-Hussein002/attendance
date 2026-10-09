import { Body, Controller, Post } from '@nestjs/common';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private svc: AuthService) {}
  @Post('login') login(@Body() b: { companyCode?: string; email: string; password: string; deviceUid?: string }) { return this.svc.login(b); }
  @Post('verify-otp') verify(@Body() b: { challengeId: string; code: string; deviceUid?: string }) { return this.svc.verifyOtp(b); }
  @Post('set-password') setPassword(@Body() b: { changeToken: string; newPassword: string }) { return this.svc.setPassword(b); }
  @Post('refresh') refresh(@Body() b: { refreshToken: string; deviceUid?: string }) { return this.svc.refresh(b); }
  @Post('logout') logout(@Body() b: { refreshToken: string }) { return this.svc.logout(b.refreshToken); }
}
