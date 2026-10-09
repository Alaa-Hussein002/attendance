import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** AES-256-GCM. The key derives from JWT_SECRET, so rotating that secret means the admin re-enters the WhatsApp token. */
const key = () => createHash('sha256').update(`${process.env.JWT_SECRET}:whatsapp`).digest();
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
export function decryptSecret(b64: string): string {
  const raw = Buffer.from(b64, 'base64'); const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}

/** "05xxxxxxxx" / "+9665xxxxxxxx" / "009665xxxxxxxx" -> "9665xxxxxxxx" (digits only, as the Cloud API wants). */
export function normalizePhone(raw: string, country = '966'): string | null {
  let d = String(raw ?? '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = country + d.slice(1);
  return /^\d{9,15}$/.test(d) ? d : null;
}
/** Template message body for the WhatsApp Cloud API (messages must use templates approved in Meta Business). */
export function buildTemplatePayload(o: { to: string; template: string; language: string; params: string[] }) {
  return { messaging_product: 'whatsapp', to: o.to, type: 'template',
    template: { name: o.template, language: { code: o.language }, components: [{ type: 'body', parameters: o.params.map((t) => ({ type: 'text', text: t.replace(/[\n\t]+/g, ' ').slice(0, 900) })) }] } };
}
