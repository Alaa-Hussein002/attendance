import { Body, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { toLocalParts } from '@attendance/shared';
import { Auth, AuthCtx, requireRole } from '../common/auth-context';
import { ADMIN_ONLY, check } from '../common/http';
import { PrismaService } from '../common/prisma.service';
import { randomBytes } from 'crypto';
import { sha256 } from '../auth/crypto';
import { AgentService } from '../agent/agent.service';

interface DeviceDto { branchId: string; name: string; brand?: string; model?: string; host: string; port?: number; serialNumber?: string; active?: boolean; notes?: string }
const HOST_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[a-zA-Z0-9]([a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?)$/;
const ONLINE_MS = 3 * 60000;
const newKey = () => `bmk_${randomBytes(32).toString('base64url')}`;
const pub = (d: any) => { const { apiKeyHash, ...rest } = d; return { ...rest, hasKey: !!apiKeyHash }; };

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService, private agent: AgentService) {}
  private async valid(a: AuthCtx, d: DeviceDto) {
    check(d.name?.trim(), 'NAME_REQUIRED'); check(HOST_RE.test(d.host ?? ''), 'INVALID_HOST');
    const port = d.port ?? 4370; check(Number.isInteger(port) && port > 0 && port < 65536, 'INVALID_PORT');
    check(await this.prisma.branch.findFirst({ where: { id: d.branchId, companyId: a.companyId } }), 'BRANCH_NOT_FOUND');
    return port;
  }

  /** Devices with live counters: online state, today's punches by outcome, and totals. */
  async list(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } }); const today = toLocalParts(new Date(), company!.timezone).date;
    const [devices, todayRows, totalRows] = await Promise.all([
      this.prisma.biometricDevice.findMany({ where: { companyId }, orderBy: { name: 'asc' } }),
      this.prisma.punchLog.groupBy({ by: ['deviceId', 'result'], where: { companyId, localDate: today }, _count: { _all: true } }),
      this.prisma.punchLog.groupBy({ by: ['deviceId'], where: { companyId }, _count: { _all: true } }),
    ]);
    const now = Date.now();
    return devices.map((d: any) => {
      const t: Record<string, number> = {}; let total = 0;
      for (const r of todayRows as any[]) if (r.deviceId === d.id) { t[r.result] = r._count._all; total += r._count._all; }
      return { ...pub(d), online: !!d.lastSeenAt && now - new Date(d.lastSeenAt).getTime() < ONLINE_MS,
        today: { total, recorded: (t.RECORDED ?? 0) + (t.IMPROVED ?? 0), duplicate: t.DUPLICATE_DAY ?? 0, unmapped: t.UNMAPPED ?? 0, other: (t.NOT_TRACKED ?? 0) + (t.TOO_LATE ?? 0) + (t.NO_POLICY ?? 0) },
        totalPunches: (totalRows as any[]).find((r) => r.deviceId === d.id)?._count._all ?? 0 };
    });
  }
  /** Fingerprint ids seen on a device that no employee owns yet. */
  async unmapped(companyId: string) {
    const rows: any = await this.prisma.punchLog.groupBy({ by: ['deviceId', 'biometricId'], where: { companyId, result: 'UNMAPPED' }, _count: { _all: true }, _max: { punchedAtLocal: true } });
    const devs = await this.prisma.biometricDevice.findMany({ where: { companyId } });
    return rows.map((r: any) => ({ deviceId: r.deviceId, deviceName: devs.find((d: any) => d.id === r.deviceId)?.name ?? '—', biometricId: r.biometricId, punches: r._count._all, lastPunch: r._max.punchedAtLocal })).sort((a: any, b: any) => b.punches - a.punches);
  }

  async create(a: AuthCtx, d: DeviceDto) {
    const port = await this.valid(a, d); const apiKey = newKey();
    const row = await this.prisma.biometricDevice.create({ data: { companyId: a.companyId, branchId: d.branchId, name: d.name.trim(), brand: d.brand ?? 'ZKTECO', model: d.model?.trim() || null,
      host: d.host.trim(), port, serialNumber: d.serialNumber?.trim() || null, notes: d.notes?.slice(0, 300) || null, apiKeyHash: sha256(apiKey) } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'DEVICE_CREATE', entity: 'BiometricDevice', entityId: row.id, after: pub(row) as any } });
    return { ...pub(row), apiKey }; // the key is shown ONCE; only its hash is stored
  }
  async rotateKey(a: AuthCtx, id: string) {
    const d = await this.prisma.biometricDevice.findFirst({ where: { id, companyId: a.companyId } }); if (!d) throw new NotFoundException('DEVICE_NOT_FOUND');
    const apiKey = newKey(); await this.prisma.biometricDevice.update({ where: { id }, data: { apiKeyHash: sha256(apiKey) } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'DEVICE_KEY_ROTATE', entity: 'BiometricDevice', entityId: id } });
    return { apiKey };
  }
  async update(a: AuthCtx, id: string, d: DeviceDto) {
    const before = await this.prisma.biometricDevice.findFirst({ where: { id, companyId: a.companyId } }); if (!before) throw new NotFoundException('DEVICE_NOT_FOUND');
    const port = await this.valid(a, d);
    const row = await this.prisma.biometricDevice.update({ where: { id }, data: { branchId: d.branchId, name: d.name.trim(), brand: d.brand ?? before.brand, model: d.model?.trim() || null, host: d.host.trim(), port, serialNumber: d.serialNumber?.trim() || null, active: d.active ?? before.active, notes: d.notes?.slice(0, 300) || null } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'DEVICE_UPDATE', entity: 'BiometricDevice', entityId: id, before: pub(before) as any, after: pub(row) as any } });
    return pub(row);
  }
  async remove(a: AuthCtx, id: string) {
    const before = await this.prisma.biometricDevice.findFirst({ where: { id, companyId: a.companyId } }); if (!before) throw new NotFoundException('DEVICE_NOT_FOUND');
    await this.prisma.biometricDevice.delete({ where: { id } });
    await this.prisma.auditLog.create({ data: { companyId: a.companyId, actorId: a.userId, action: 'DEVICE_DELETE', entity: 'BiometricDevice', entityId: id, before: pub(before) as any } });
    return { ok: true };
  }
  reprocess(companyId: string) { return this.agent.reprocess(companyId); }
}

@Controller('biometric-devices')
export class DevicesController {
  constructor(private svc: DevicesService) {}
  @Get() list(@Auth() a: AuthCtx) { requireRole(a, ...ADMIN_ONLY); return this.svc.list(a.companyId); }
  @Get('unmapped') unmapped(@Auth() a: AuthCtx) { requireRole(a, ...ADMIN_ONLY); return this.svc.unmapped(a.companyId); }
  @Post('reprocess') reprocess(@Auth() a: AuthCtx) { requireRole(a, ...ADMIN_ONLY); return this.svc.reprocess(a.companyId); }
  @Post() create(@Auth() a: AuthCtx, @Body() b: DeviceDto) { requireRole(a, ...ADMIN_ONLY); return this.svc.create(a, b); }
  @Post(':id/key') rotate(@Auth() a: AuthCtx, @Param('id') id: string) { requireRole(a, ...ADMIN_ONLY); return this.svc.rotateKey(a, id); }
  @Put(':id') update(@Auth() a: AuthCtx, @Param('id') id: string, @Body() b: DeviceDto) { requireRole(a, ...ADMIN_ONLY); return this.svc.update(a, id, b); }
  @Delete(':id') remove(@Auth() a: AuthCtx, @Param('id') id: string) { requireRole(a, ...ADMIN_ONLY); return this.svc.remove(a, id); }
}
