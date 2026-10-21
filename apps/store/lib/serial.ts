/** Generates a human-readable, unique serial. Uses Crockford-style base32 without ambiguous chars. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateSerial(): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let s = '';
    const arr = new Uint8Array(4);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 4; i++) s += ALPHABET[arr[i] % ALPHABET.length];
    groups.push(s);
  }
  return 'BMT-' + groups.join('-');
}
