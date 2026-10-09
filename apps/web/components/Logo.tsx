/* Files live in /public/brand — replace them with the official vectors, same names. */
export function Lockup({ height = 54, invert = false }: { height?: number; invert?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-lockup.svg" alt="بيت المصور — Bayt Al Mosawer" style={{ height, width: 'auto', filter: invert ? 'invert(1)' : undefined, display: 'block' }} />;
}
export function Mark({ size = 40, invert = false, style }: { size?: number; invert?: boolean; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-mark.svg" alt="" aria-hidden style={{ height: size, width: 'auto', filter: invert ? 'invert(1)' : undefined, ...style }} />;
}
