# Selling Bayt Al Mosawer — playbook

> **Archived:** the subscription/storefront model was removed. The product is now a single company (Bayt Al Mosawer) with branches. This file is kept for history only.

## The model (what we built)

- **One universal installer** for every customer. The installer is identical for all companies.
- **One license key per company**, issued by you (the vendor) after payment. The key is an
  Ed25519-signed `BMK1.<payload>.<signature>` token that the customer's own server verifies
  **offline** — no internet is required for the system to run.
- **A serial number** (`BMT-XXXX-XXXX-XXXX-XXXX`) is issued per subscription. It is unique
  (database-enforced) and never reused. It is sent to the buyer's email together with the
  full activation key.
- **Offline subscription**: when the key expires, the system enters `RESTRICTED` mode —
  check-in keeps working, but management actions are disabled and the UI links to your
  storefront for renewal.
- **Anti-rollback**: the installation remembers the latest time it has ever seen, so a
  rolled-back clock cannot extend a subscription.

## The flow a customer follows

1. Customer visits the storefront (`apps/store`) and reads the landing page.
2. Chooses a plan and checks out (Moyasar — mada / Visa / Mastercard / Apple Pay).
3. The storefront issues a unique serial + signed key and emails both to the buyer.
4. Customer downloads the universal installer from the storefront.
5. Customer installs on their own server (Docker Compose, one command).
6. Customer completes the setup wizard (company name, admin password, time zone).
7. Customer opens the **Subscription** page, sees their **installation ID**, and pastes the
   key they received by email → **Activate**.
8. The system runs. When the subscription expires, the customer renews on the storefront;
   you issue a new key (or extend the existing serial) and email it.

## Distribution

- **Self-hosted per company**: every company runs their own instance (DB + API + web).
  This is what the installer provides. Their data never leaves their building.
- **One installer serves many companies**: the same installer archive is used by everyone;
  the license key is what binds a company. No per-company build is needed.
- **Mobile app**: published once to the App Store / Play Store (Expo). It talks to the
  customer's own API URL, configured on first login via the company code. One binary,
  many companies.

## Vendor operations (you)

- Host the storefront (`apps/store`) on your domain. It is the only piece you operate.
- Hold the Ed25519 **private key** offline (generated once with
  `npm run license:keygen -w @attendance/api`). Never commit it. Back it up.
- Put the **public key** (base64) in every customer's `apps/api/.env` as `LICENSE_PUBLIC_KEY`.
- Issue keys manually with `npm run license:issue -w @attendance/api -- --customer "..." --plan BUSINESS --days 365`
  or through the storefront admin panel (`/admin`).
- Publish installer releases through the storefront admin → **Releases** tab, then upload the
  archive to `/releases/<filename>` (or a CDN) so the download page can serve it.

## Environment variables you must set (vendor side)

See `apps/store/.env.example`. The critical ones:

- `LICENSE_PRIVATE_KEY` (or `LICENSE_PRIVATE_KEY_FILE`) — the signing key. Required to issue keys.
- `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` — protect `/admin`.
- `SMTP_*` — license delivery email.
- `MOYASAR_SECRET_KEY` — real payments (leave empty to use the mock simulator while testing).
- `NEXT_PUBLIC_BASE_URL` — your storefront's public URL.

## Renewal & expiry behaviour

- `TRIAL` (14 days) → `ACTIVE` → `EXPIRING` (≤14 days left) → `GRACE` (14 days) → `RESTRICTED`.
- In `RESTRICTED`, check-in still works; management actions are disabled and the UI links to
  the vendor site. The customer can paste a new key on the Subscription page to restore access.

## What is NOT done yet (roadmap)

- Full i18n migration of every web page and every mobile screen (infrastructure is in place;
  the migration is mechanical and follows the `t('...')` pattern).
- `LeaveType` paid/unpaid leave types affecting payroll (model exists, wiring pending).
- Per-company multi-tenant hosting (today each company self-hosts; a hosted SaaS variant
  would need tenant isolation in the API).
- Automated installer build (Docker images are built manually today).
- Mobile app store submission (Expo build + store listing).
- Legal: terms of service, privacy policy, refund policy pages on the storefront.
