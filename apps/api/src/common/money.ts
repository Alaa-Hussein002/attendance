/** DB stores SAR as Decimal; the engine works in integer halalas. */
export const toMinor = (d: { toString(): string } | number | null | undefined) => Math.round(Number(d?.toString() ?? 0) * 100);
export const fromMinor = (m: number) => (m / 100).toFixed(2);
