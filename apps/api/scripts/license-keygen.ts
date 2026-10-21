// VENDOR ONLY. Creates the signing key pair once. The PRIVATE key never goes to a customer or to Git.
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generateKeyPair } from '../src/license/license';

const out = process.argv[2] ?? 'license-keys';
if (existsSync(join(out, 'license-private.pem'))) { console.error(`Refusing to overwrite ${out}/license-private.pem (would invalidate every key you ever issued).`); process.exit(1); }
mkdirSync(out, { recursive: true });
const { publicPem, privatePem } = generateKeyPair();
writeFileSync(join(out, 'license-private.pem'), privatePem, { mode: 0o600 }); try { chmodSync(join(out, 'license-private.pem'), 0o600); } catch { /* windows */ }
writeFileSync(join(out, 'license-public.pem'), publicPem);
console.log(`Created ${out}/license-private.pem  (KEEP SECRET, back it up offline)\nCreated ${out}/license-public.pem\n\nPut this in apps/api/.env of every installation:\nLICENSE_PUBLIC_KEY=${Buffer.from(publicPem).toString('base64')}`);
