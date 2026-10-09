import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AgentService } from './agent.service';

const ID_RE = /^[A-Za-z0-9_-]{1,24}$/; const TIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

/** Called by the on-premise agent (not by people). Authenticated by a per-device key, never by a user token. */
@Public()
@Controller('agent')
export class AgentController {
  constructor(private svc: AgentService) {}
  @Post('heartbeat') async heartbeat(@Headers('x-device-key') key: string, @Body() b: { deviceTime?: string }) { return this.svc.heartbeat(await this.svc.auth(key), b ?? {}); }
  @Post('punches') async punches(@Headers('x-device-key') key: string, @Body() b: { punches: { biometricId: string; time: string }[] }) {
    const dev = await this.svc.auth(key); const list = b?.punches;
    if (!Array.isArray(list) || list.length > 500) throw new BadRequestException('INVALID_PUNCHES');
    for (const p of list) if (!ID_RE.test(String(p?.biometricId ?? '')) || !TIME_RE.test(String(p?.time ?? ''))) throw new BadRequestException('INVALID_PUNCHES');
    return this.svc.punches(dev, list.map((p) => ({ biometricId: String(p.biometricId), time: String(p.time) })));
  }
}
