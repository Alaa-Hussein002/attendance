# خطة نشر وتجربة Bayt Al Mosawer — كاملة

## 0) ما الذي ننشره وأين

| مكوّن | أين يُنشر | من يُشغّله | لماذا |
|---|---|---|---|
| **storefront** (`apps/store`) — صفحة هبوط + دفع + عملاء + إصدار مفاتيح | **Vercel** (free) | أنت (البائع) | واجهة للعملاء، لا حاجة لخادم |
| **database** storefront | **Neon** (free Postgres) أو Vercel Postgres | أنت | persistence (SQLite لا يعمل على Vercel) |
| **النظام** (`apps/api` + `apps/web` + DB) | **Docker** على خادم العميل (أو VPS) | العميل | self-hosted، بيانات العميل لا تغادر مبناه |
| **التطبيق** (`apps/mobile`) | **Google Play + App Store** | أنت (نشر مرة) | binary واحد، لكل الشركات |

---

## 1) نشر المتجر (storefront) على Vercel — مجاني

### 1.1 إعداد DB (Neon — مجاني)
1. اذهب إلى https://neon.tech → Sign up (مجاني).
2. Create project → name: `baytalmosawer-store`.
3. انسخ **Connection string** (postgresql://...).
4. في Vercel → Project → Settings → Environment Variables → أضف `DATABASE_URL` = connection string.

### 1.2 نشر على Vercel
1. ارفع `D:\Project\attendance` إلى GitHub (أو GitLab).
2. Vercel → New Project → Import repo.
3. **Root Directory**: `apps/store`.
4. Framework Preset: Next.js (auto).
5. Build Command: `prisma generate && next build` (auto from vercel.json).
6. Environment Variables (أضف جميعها من `apps/store/.env.example`):
   - `DATABASE_URL` (من Neon)
   - `NEXT_PUBLIC_BASE_URL` = `https://your-store.vercel.app`
   - `ADMIN_PASSWORD` = كلمة مرور قوية
   - `ADMIN_SESSION_SECRET` = سلسلة عشوائية ≥32
   - `LICENSE_PRIVATE_KEY` = محتوى `license-keys/license-private.pem` (أو base64)
   - `SMTP_HOST/PORT/SECURE/USER/PASS/FROM_NAME`
   - `PAYMENTS_MODE` = `mock` (للتجربة) أو اتركه فارغاً + `MOYASAR_SECRET_KEY` (للإنتاج)
   - `NEXT_PUBLIC_VENDOR_URL` = `https://your-store.vercel.app`
7. Deploy.

### 1.3 إعداد DB (أول مرة)
بعد النشر، شغّل مرة واحدة (من جهازك):
```bash
cd apps/store
DATABASE_URL="postgresql://..." npx prisma db push
```
(أو أضف `prisma db push` إلى build command في Vercel.)

### 1.4 التحقق
- افتح `https://your-store.vercel.app` → صفحة هبوط (عربي/إنجليزي).
- `/plans` → باقات.
- `/admin` → login (ADMIN_PASSWORD) → dashboard.
- `/admin` → Issue a license → أدخل بريدك → تحقق من استلام serial + key بالبريد.

---

## 2) تثبيت النظام (العميل) — Docker one-click

### 2.1 للعميل (Windows)
1. نزّل `install.cmd` من `deploy/` (أو أرسله بالبريد).
2. **انقر مرتين** (double-click) → يفعل كل شيء:
   - يتحقق من Docker.
   - ينشئ مجلد `%USERPROFILE%\BaytAlMosawer`.
   - ينزّل `docker-compose.yml`.
   - يُولّد `.env` (مفاتيح عشوائية).
   - ينزّل الصور (`docker compose pull`).
   - يبدأ الخدمات (`docker compose up -d`).
   - **يفتح المتصفح تلقائياً** على `http://localhost:3000`.
3. **معالج الإعداد** (أول مرة): اسم المنشأة، المدير، المنطقة الزمنية، مفتاح الإعداد (اختياري).
4. **صفحة الاشتراك**: انسخ `Installation ID` → أرسله للبائع (أنت) → البائع يُصدر مفتاحاً → العميل يلصقه → **Activate**.

### 2.2 للعميل (Linux/macOS)
```bash
curl -fsSL https://raw.githubusercontent.com/baytalmosawer/attendance/main/deploy/install.sh | bash
```
يفعل نفس الشيء + يفتح المتصفح (xdg-open/open).

### 2.3 بديل (بدون Docker) — portable bundle
- (اختياري) bundling Node.js + Postgres → extract → `start.cmd` → browser opens. أكبر (~200MB) but zero Docker. (TODO: build script.)

### 2.4 التحقق (العميل)
- `http://localhost:3000` → setup wizard.
- أكمل الإعداد → login.
- Employees/Branches/Reports/Settings تعمل.
- Subscription page → installation ID + paste key → Activate → status ACTIVE.

---

## 3) التطبيق (الجوال) — متجر Play + App Store

### 3.1 إعداد EAS (مرة واحدة)
```bash
cd apps/mobile
npm install -g eas-cli
eas login
eas build:configure   # uses eas.json
```

### 3.2 بناء (Build)
```bash
# Android (APK for testing, AAB for store)
eas build --platform android --profile preview   # APK (internal testing)
eas build --platform android --profile production # AAB (Play Store)

# iOS
eas build --platform ios --profile production     # IPA (App Store)
```

### 3.3 نشر على المتاجر
**Google Play:**
1. Google Play Console → Create app → Internal testing track.
2. Upload AAB → Add testers (email list) → testers receive link → install.
3. (لاحقاً) Production track → review → publish.

**App Store:**
1. App Store Connect → New App → Upload IPA via Transporter.
2. TestFlight → internal/external testers.
3. (لاحقاً) Submit for review → publish.

### 3.4 كيف يدخل الموظف
1. نزّل التطبيق من Play/App Store.
2. أدخل **رمز الشركة** (مثلاً `BMS-001`) + بريد + كلمة مرور (default `12345678`).
3. أول login: OTP بالبريد → عيّن كلمة مرور شخصية.
4. device binding: التطبيق يُرسل `deviceUid` (UUID محفوظ في SecureStore) → API يربط الجهاز.
5. **المرات التالية**: companyCode + deviceUid يُحمَّلان من SecureStore → login تلقائي (أو biometric).

### 3.5 التحقق (جوال)
- `expo start` (dev) → scan QR → login → Home/Records/Tasks/Requests/Profile.
- EAS preview build → install on device → login → تحقق من device binding.
- تحقق من RTL/LTR (تبديل لغة في Profile).

---

## 4) تجربة مجانية حقيقية (Free real test) — خطوة بخطوة

### A. vendor side (storefront) — Vercel
1. GitHub repo (push `D:\Project\attendance`).
2. Vercel → Import → root `apps/store` → Deploy.
3. Neon → create DB → `DATABASE_URL` in Vercel env.
4. `npx prisma db push` (once) to create tables.
5. `PAYMENTS_MODE=mock` (للتجربة) → `/admin` → Issue a license → أدخل بريدك → تحقق من استلام serial + key.

### B. customer side (self-hosted) — local
1. `docker compose up -d` (root) → Postgres.
2. `npm run api:setup` (migrate) → `npm run api` (port 3000) + `npm run web` (port 3001).
3. `http://localhost:3000` → setup wizard.
4. `/subscription` → copy Installation ID → storefront `/admin` → Issue license (bound to installation ID) → paste key → Activate.
5. تحقق: status ACTIVE، employees/branches/reports تعمل.

### C. جوال (test)
1. `cd apps/mobile && npm install && npx expo start`.
2. Scan QR → login (companyCode + email + 12345678).
3. تحقق: Home, Records, Tasks, Requests, Profile، تبديل لغة.

### D. اختبار انتهاء الاشتراك
1. أصدر مفتاحاً بـ `--days 1` (أو عدّل DB).
2. انتظر يوم (أو عدّل `validUntil` في DB).
3. تحقق: status GRACE → RESTRICTED; check-in لا يزال يعمل، management معطّل + رابط renewal.

---

## 5) checklist النشر (Production)

### Vendor (أنت)
- [ ] GitHub repo (push).
- [ ] Neon DB + Vercel storefront deploy.
- [ ] `prisma db push` (tables).
- [ ] توليد Ed25519 key pair (`npm run license:keygen -w @attendance/api`) → **احفظ private offline**.
- [ ] `LICENSE_PRIVATE_KEY` in Vercel env.
- [ ] `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` (strong).
- [ ] SMTP (Gmail app password) configured.
- [ ] Moyasar account → `MOYASAR_SECRET_KEY` (أو اترك mock للتجربة).
- [ ] EAS build → Play Store + App Store (internal testing track).
- [ ] publish `install.cmd`/`install.sh` + `deploy/docker-compose.yml` (GitHub raw URL).
- [ ] صفحات قانونية (ToS/Privacy/Refund) على storefront.

### العميل (per company)
- [ ] تنزيل `install.cmd`/`install.sh` → تشغيل.
- [ ] setup wizard (company name, admin password, timezone).
- [ ] Subscription page → Installation ID → إرسال للبائع.
- [ ] receiving key by email → paste → Activate.
- [ ] employees/branches setup.
- [ ] (اختياري) تطبيق جوال: Play/App Store → login برمز الشركة.

---

## 6) ما بقي (roadmap)
- i18n migration لبقية صفحات web/mobile (mechanical, نمط `t('...')`).
- LeaveType paid/unpaid wiring.
- CI/CD (GitHub Actions → Vercel + Docker Hub).
- OTA updates (expo-updates).
- per-company multi-tenant (اختياري — اليوم self-hosted).
- automated installer build (Docker images pushed to registry).

---

## 7) ملفات رئيسية (للمرجع)
- `deploy/install.cmd`, `deploy/install.sh` — one-click customer installer.
- `deploy/docker-compose.yml`, `deploy/Dockerfile.api`, `deploy/Dockerfile.web` — container build.
- `apps/store/vercel.json` — Vercel config.
- `apps/mobile/eas.json` — EAS build profiles.
- `docs/SALES.md` — playbook البيع.
- `docs/DEPLOYMENT.md` — this file.
- `apps/store/.env.example`, `apps/web/.env.example`, `apps/api/.env.example` — env vars.