/** Pure check-in decision. SERVER time is authoritative; client time is only used to flag anomalies. */
import { AttendancePolicy } from './engine';
import { hhmmToMinutes, toLocalParts } from './time';
import { haversineMeters, ipInRanges } from './geo';
import { TaskSite, taskWindowOpen } from './tasks';

export type VerifyMode = 'GPS' | 'NETWORK' | 'FINGERPRINT';
export interface BranchConfig {
  latitude?: number; longitude?: number; radiusMeters?: number;
  allowedIpRanges: string[]; modes: VerifyMode[];
}
export interface CheckInRequest {
  serverTime: Date; clientTime?: Date; ip?: string;
  lat?: number; lng?: number; mockLocation?: boolean;
  deviceUid?: string; boundDeviceUid?: string | null;
  taskSites?: TaskSite[];       // today's tasks of this employee (outside-the-office work)
}
export type RejectCode =
  | 'DEVICE_NOT_BOUND' | 'DEVICE_MISMATCH' | 'NO_VERIFICATION_MODE'
  | 'NOT_IN_LOCATION' | 'MOCK_LOCATION' | 'TOO_LATE';
export interface CheckInDecision {
  allowed: boolean; code?: RejectCode; source?: 'GPS' | 'NETWORK' | 'TASK'; taskId?: string;
  status: string | null;     // tier key (GREEN/RED/...) or the absent tier key when TOO_LATE
  localDate: string; flags: string[]; distanceMeters?: number;
}
export const CLOCK_SKEW_MINUTES = 5;

export function decideCheckIn(branch: BranchConfig, policy: AttendancePolicy, req: CheckInRequest,
  timeZone = 'Asia/Riyadh'): CheckInDecision {
  const { date, minutes } = toLocalParts(req.serverTime, timeZone);
  const flags: string[] = [];
  const out = (o: Partial<CheckInDecision>): CheckInDecision =>
    ({ allowed: false, status: null, localDate: date, flags, ...o });

  if (req.clientTime && Math.abs(req.clientTime.getTime() - req.serverTime.getTime()) > CLOCK_SKEW_MINUTES * 60000) flags.push('CLOCK_SKEW');
  if (req.mockLocation) flags.push('MOCK_LOCATION');

  if (!req.boundDeviceUid) return out({ code: 'DEVICE_NOT_BOUND' });
  if (req.deviceUid !== req.boundDeviceUid) return out({ code: 'DEVICE_MISMATCH' });

  const modes = branch.modes.filter((m) => m !== 'FINGERPRINT'); // fingerprint arrives via the Agent, not this path
  const sites = (req.taskSites ?? []).filter((t) => taskWindowOpen(t, minutes));
  if (!modes.length && !sites.length) return out({ code: 'NO_VERIFICATION_MODE' });

  let source: 'GPS' | 'NETWORK' | 'TASK' | undefined; let distance: number | undefined; let taskId: string | undefined; let offset = 0;
  // 1) the branch / office (preferred)
  if (modes.includes('NETWORK') && ipInRanges(req.ip, branch.allowedIpRanges)) source = 'NETWORK';
  else if (modes.includes('GPS') && branch.latitude !== undefined && branch.longitude !== undefined && branch.radiusMeters) {
    if (req.lat !== undefined && req.lng !== undefined) {
      distance = haversineMeters(req.lat, req.lng, branch.latitude, branch.longitude);
      if (distance <= branch.radiusMeters && !req.mockLocation) source = 'GPS';
    }
  }
  // 2) a task location (working away from the office). Lateness is then measured from the TASK start, not the office shift.
  if (!source && sites.length && req.lat !== undefined && req.lng !== undefined) {
    for (const t of sites) {
      const dd = haversineMeters(req.lat, req.lng, t.lat, t.lng);
      if (dd <= t.radiusMeters) { if (req.mockLocation) return out({ code: 'MOCK_LOCATION' }); source = 'TASK'; taskId = t.id; distance = dd; offset = t.startMinutes - hhmmToMinutes(policy.shiftStart); break; }
    }
  }
  if (!source && req.mockLocation && modes.includes('GPS')) return out({ code: 'MOCK_LOCATION' });
  if (!source) return out({ code: 'NOT_IN_LOCATION', distanceMeters: distance });

  const shifted = minutes - offset;
  const tier = policy.tiers.find((t) => shifted <= hhmmToMinutes(t.until!));
  if (!tier) return out({ code: 'TOO_LATE', source, taskId, status: policy.absentTier.key, distanceMeters: distance });
  return out({ allowed: true, source, taskId, status: tier.key, distanceMeters: distance });
}
