/** Distance in meters between two coordinates (haversine). */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, rad = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function ipv4ToInt(ip: string): number | null {
  const m = ip.replace(/^::ffff:/i, '').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}

/** IPv4 match against a list of CIDRs or single IPs. */
export function ipInRanges(ip: string | undefined, ranges: string[]): boolean {
  if (!ip) return false;
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return ranges.some((r) => {
    const [base, bitsStr] = r.trim().split('/');
    const b = ipv4ToInt(base);
    const bits = bitsStr === undefined ? 32 : Number(bitsStr);
    if (b === null || !(bits >= 0 && bits <= 32)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
}

/** Validates "a.b.c.d" or "a.b.c.d/nn". */
export function isValidIpRange(r: string): boolean {
  const [base, bits] = r.trim().split('/');
  if (ipv4ToInt(base) === null) return false;
  return bits === undefined || (/^\d{1,2}$/.test(bits) && Number(bits) <= 32);
}
