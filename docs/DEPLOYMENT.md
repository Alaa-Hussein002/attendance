# خطة نشر وتجربة Bayt Al Mosawer — كاملة

> **تحديث المنتج:** أُلغي نظام الاشتراكات والمتجر. النظام الآن لشركة واحدة بعدة فروع، ولا حاجة لأي مفاتيح ترخيص. انشر `apps/web` فقط (إعداد `vercel.json` في الجذر يشير إليه).

## 0) ما الذي ننشره وأين

| مكوّن | أين يُنشر | من يُشغّله | لماذا |
|---|---|---|---|
| **النظام** (`apps/api` + `apps/web` + DB) | **Docker** على خادم العميل (أو VPS) | العميل | self-hosted، بيانات العميل لا تغادر مبناه |
| **التطبيق** (`apps/mobile`) | **Google Play + App Store** | أنت (نشر مرة) | binary واحد للعميل |

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
3. **معالج الإعداد** (أول مرة): اسم المدير، بريده، كلمة المرور، المنطقة الزمنية، مفتاح الإعداد (اختياري). اسم الشركة ثابت: «بيت المصور».

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
- لا توجد صفحة اشتراك أو مفاتيح ترخيص.

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
2. أدخل البريد + كلمة المرور (default `12345678`). لا يوجد رمز شركة.
3. أول login: OTP بالبريد → عيّن كلمة مرور شخصية.
4. device binding: التطبيق يُرسل `deviceUid` (UUID محفوظ في SecureStore) → API يربط الجهاز.
5. **المرات التالية**: deviceUid يُحمَّل من SecureStore → login تلقائي (أو biometric).

### 3.5 التحقق (جوال)
- `expo start` (dev) → scan QR → login → Home/Records/Tasks/Requests/Profile.
- EAS preview build → install on device → login → تحقق من device binding.
- تحقق من RTL/LTR (تبديل لغة في Profile).

---

## 4) تجربة محلية سريعة

### A. النظام
1. `docker compose up -d` لتشغيل PostgreSQL.
2. `npm run api:setup` لتجهيز قاعدة البيانات.
3. `npm run api` (المنفذ 3000) و`npm run web` (المنفذ 3001).
4. افتح `http://localhost:3001` → معالج الإعداد. اسم الشركة ثابت: «بيت المصور».

### B. الجوال
1. `cd apps/mobile && npm install && npx expo start`.
2. امسح QR → سجّل الدخول بالبريد وكلمة المرور.
3. تحقق من الرئيسية، السجلات، المهام، الطلبات، الملف الشخصي، وتبديل اللغة.

---

## 5) checklist النشر (Production)

### الخادم
- [ ] Docker + `deploy/docker-compose.yml`.
- [ ] `DB_PASSWORD` و`JWT_SECRET` قويان.
- [ ] SMTP مُعدّ لإرسال رموز التحقق.
- [ ] نسخ احتياطي دوري لقاعدة البيانات.
- [ ] `npm run api:setup` ثم تشغيل API وWeb.

### الجوال
- [ ] EAS build → Play Store + App Store.
- [ ] اختبار تسجيل الدخول وربط الجهاز والتحقق من الموقع.

---

## 6) ما بقي (roadmap)
- استكمال تغطية i18n لبقية النصوص إن ظهرت.
- ربط أنواع الإجازات المدفوعة/غير المدفوعة.
- CI/CD (GitHub Actions → Vercel + Docker Hub).
- OTA updates (expo-updates).
- automated installer build (Docker images pushed to registry).

---

## 7) ملفات رئيسية (للمرجع)
- `deploy/install.cmd`, `deploy/install.sh` — one-click customer installer.
- `deploy/docker-compose.yml`, `deploy/Dockerfile.api`, `deploy/Dockerfile.web` — container build.
- `apps/web/.env.example`, `apps/api/.env.example` — env vars.
- `apps/mobile/eas.json` — EAS build profiles.
- `docs/DEPLOYMENT.md` — this file.
