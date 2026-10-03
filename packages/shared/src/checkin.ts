/** Pure check-in decision. SERVER time is authoritative; client time is only used to flag anomalies. */
import { AttendancePolicy } from './engine';
import { hhmmToMinutes, toLocalParts } from './time';
import { haversineMeters, ipInRanges } from './geo';

export type VerifyMode = 'GPS' | 'NETWORK' | 'FINGERPRINT';
export interface BranchConfig {
  latitude?: number; longitude?: number; radiusMeters?: number;
  allowedIpRanges: string[]; modes: VerifyMode[];
}
export interface CheckInRequest {
  serverTime: Date; clientTime?: Date; ip?: string;
  lat?: number; lng?: number; mockLocation?: boolean;
  deviceUid?: string; boundDeviceUid?: string | null;
}
export type RejectCode =
  | 'DEVICE_NOT_BOUND' | 'DEVICE_MISMATCH' | 'NO_VERIFICATION_MODE'
  | 'NOT_IN_LOCATION' | 'MOCK_LOCATION' | 'TOO_LATE';
export interface CheckInDecision {
  allowed: boolean; code?: RejectCode; source?: 'GPS' | 'NETWORK';
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
  if (!modes.length) return out({ code: 'NO_VERIFICATION_MODE' });

  let source: 'GPS' | 'NETWORK' | undefined; let distance: number | undefined;
  if (modes.includes('NETWORK') && ipInRanges(req.ip, branch.allowedIpRanges)) source = 'NETWORK';
  else if (modes.includes('GPS') && branch.latitude !== undefined && branch.longitude !== undefined && branch.radiusMeters) {
    if (req.mockLocation) return out({ code: 'MOCK_LOCATION' });
    if (req.lat !== undefined && req.lng !== undefined) {
      distance = haversineMeters(req.lat, req.lng, branch.latitude, branch.longitude);
      if (distance <= branch.radiusMeters) source = 'GPS';
    }
  }
  if (!source) return out({ code: 'NOT_IN_LOCATION', distanceMeters: distance });

  const tier = policy.tiers.find((t) => minutes <= hhmmToMinutes(t.until!));
  if (!tier) return out({ code: 'TOO_LATE', source, status: policy.absentTier.key, distanceMeters: distance });
  return out({ allowed: true, source, status: tier.key, distanceMeters: distance });
}
