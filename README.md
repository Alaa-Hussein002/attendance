# بيت المصور — نظام الحضور والرواتب

Monorepo: `packages/shared` (محرك النقاط والرواتب) · `apps/api` (NestJS + Prisma + PostgreSQL) · `apps/web` (لوحة الإدارة، Next.js) · `apps/mobile` (تطبيق الموظفين، Expo) · `apps/agent` (برنامج جهاز البصمة).

## التشغيل
```bash
npm install                                  # الـ API والويب والحزمة المشتركة
cd apps/mobile && npm install && cd ../..    # الجوال مشروع مستقل
```
1. **ملف إعدادات الـ API:** انسخ `apps/api/.env.example` إلى `apps/api/.env` وعبّئه (قاعدة البيانات، `JWT_SECRET`، وبيانات البريد).
   - **البريد (رموز OTP):** أنشئ «كلمة مرور تطبيق» من حساب Google للبريد المُرسِل، وضعها في `SMTP_PASS` **في ملف `.env` فقط**. لا تضعها في Git ولا في المحادثات.
   - بدون إعداد البريد في وضع التطوير تُطبع الرسالة (وفيها الرمز) في طرفية الـ API.
2. **قاعدة البيانات:** `npm run api:setup` (يولّد Prisma وينشئ الجداول).
3. **تشغيل:** `npm run api` ثم `npm run web` (http://localhost:3001) ثم `cd apps/mobile && npm start`.
4. **أول تشغيل:** افتح الويب، ستظهر شاشة **تهيئة النظام**: أنشئ حساب مدير النظام وأكّد بريدك برمز OTP.

### البدء من جديد (يمسح كل البيانات)
```bash
cd apps/api && npm run db:reset && cd ../.. && npm run api:setup
```
بيانات تجريبية اختيارية: `npm run seed -w @attendance/api` (حساب `hr@demo.test` وكلمة `ChangeMe!123`).

## الجوال
```bash
cd apps/mobile
copy .env.example .env      # ضع EXPO_PUBLIC_API_URL=http://عنوان-جهازك:3000
npx expo start -c           # دائماً مع -c بعد تعديل .env
```

## الهوية البصرية
مأخوذة من «Brand Identity presentation». ملفات الشعار في `apps/web/public/brand` و`apps/mobile/assets` (مُستخرجة من الـ PDF)؛ **استبدلها بالملفات الرسمية بنفس الأسماء** عند توفرها.

## الصلاحيات
| الدور | يرى في لوحة الويب |
|---|---|
| مدير النظام | كل شيء: الإعدادات، الفروع، أجهزة البصمة، واتساب، العطل + ما يراه HR |
| الموارد البشرية (HR) | الموظفون، التقارير والرواتب، الإجازات والأعذار، المهام |
| قائد الفريق | المهام والحجوزات فقط |
| مصوّر / موظف | لا لوحة؛ تطبيق الجوال فقط |

## المهام والحجوزات
تُنشأ من «المهام والحجوزات» (موقع على الخريطة + وقت + تفاصيل + مكلّفون). يصل المكلّف: إشعار فوري، ملخص صباحي 07:00، وتذكير قبل البدء بساعة (بريد، وواتساب إن فُعّل). يسجّل حضوره من موقع المهمة من التطبيق (من قبل البدء بساعة)، ويُحتسب التأخير من وقت بداية المهمة. المجدول يعمل داخل الـ API؛ لإيقافه: `DISABLE_SCHEDULER=true`.

## واتساب
اختياري. يحتاج اشتراك WhatsApp Business (Meta) وقوالب معتمدة. يضبطه مدير النظام من الإعدادات ← واتساب. بدونه يعمل البريد وحده.

## جهاز البصمة
أضف الجهاز من الإعدادات ← أجهزة البصمة (يظهر مفتاح الربط مرة واحدة)، ثم شغّل `apps/agent` على كمبيوتر في شبكة المقر (انظر `apps/agent/README.md`). أول بصمة في اليوم = الحضور. العدادات (اتصال، بصمات اليوم، غير مرتبطة…) تظهر في نفس الصفحة.

## الحالة
- [x] المحرك، التهيئة الأولى، الإعدادات، التقارير، الفروع بالخريطة، الموظفون، الإجازات والأعذار
- [x] المهام والحجوزات + إشعارات البريد + الحضور من موقع المهمة + تبويب المهام وسجلي في الجوال (الشهر السابق/الحالي/التالي)
- [x] برنامج جهاز البصمة (ZKTeco) + عدادات الأجهزة + ربط الأرقام بالموظفين
- [x] صلاحيات: الإدارة للأدمن فقط، وHR للموظفين والحضور والمهام
- [ ] واتساب: الكود جاهز لكنه غير مجرَّب مع حساب Meta حقيقي
- [ ] إشعارات الدفع (Push) على الجوال · تصدير Excel/PDF منسّق


```
attendance
├─ .kilo
├─ apply-deletes.cmd
├─ apps
│  ├─ agent
│  │  ├─ package.json
│  │  ├─ README.md
│  │  ├─ src
│  │  │  ├─ index.ts
│  │  │  ├─ lib.test.ts
│  │  │  ├─ lib.ts
│  │  │  └─ zk.d.ts
│  │  └─ tsconfig.json
│  ├─ api
│  │  ├─ package.json
│  │  ├─ prisma
│  │  │  ├─ migrations
│  │  │  │  ├─ 20261007190401_init
│  │  │  │  │  └─ migration.sql
│  │  │  │  └─ migration_lock.toml
│  │  │  ├─ schema.prisma
│  │  │  └─ seed.ts
│  │  ├─ src
│  │  │  ├─ agent
│  │  │  │  ├─ agent.controller.ts
│  │  │  │  ├─ agent.service.ts
│  │  │  │  └─ agent.test.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ attendance
│  │  │  │  ├─ attendance.controller.ts
│  │  │  │  └─ attendance.service.ts
│  │  │  ├─ auth
│  │  │  │  ├─ auth.controller.ts
│  │  │  │  ├─ auth.service.ts
│  │  │  │  ├─ auth.test.ts
│  │  │  │  ├─ crypto.ts
│  │  │  │  ├─ jwt.guard.ts
│  │  │  │  ├─ otp-sender.ts
│  │  │  │  ├─ otp.ts
│  │  │  │  ├─ password.ts
│  │  │  │  └─ public.decorator.ts
│  │  │  ├─ branches
│  │  │  │  └─ branches.controller.ts
│  │  │  ├─ common
│  │  │  │  ├─ auth-context.ts
│  │  │  │  ├─ email-templates.ts
│  │  │  │  ├─ http.ts
│  │  │  │  ├─ mail.service.ts
│  │  │  │  ├─ money.ts
│  │  │  │  ├─ prisma.service.ts
│  │  │  │  └─ rate-limit.ts
│  │  │  ├─ devices
│  │  │  │  └─ devices.controller.ts
│  │  │  ├─ employees
│  │  │  │  └─ employees.controller.ts
│  │  │  ├─ excuse-requests
│  │  │  │  └─ excuse-requests.controller.ts
│  │  │  ├─ holidays
│  │  │  │  └─ holidays.controller.ts
│  │  │  ├─ leaves
│  │  │  │  └─ leaves.controller.ts
│  │  │  ├─ main.ts
│  │  │  ├─ notifications
│  │  │  │  ├─ notification.service.ts
│  │  │  │  ├─ reminders.service.ts
│  │  │  │  ├─ reminders.test.ts
│  │  │  │  ├─ task-email.ts
│  │  │  │  ├─ whatsapp.controller.ts
│  │  │  │  ├─ whatsapp.service.ts
│  │  │  │  └─ whatsapp.ts
│  │  │  ├─ policies
│  │  │  │  ├─ policies.controller.ts
│  │  │  │  └─ policies.service.ts
│  │  │  ├─ reports
│  │  │  │  ├─ payroll.test.ts
│  │  │  │  ├─ payroll.ts
│  │  │  │  └─ reports.controller.ts
│  │  │  ├─ setup
│  │  │  │  └─ setup.controller.ts
│  │  │  └─ tasks
│  │  │     └─ tasks.controller.ts
│  │  └─ tsconfig.json
│  ├─ mobile
│  │  ├─ android
│  │  │  ├─ .gradle
│  │  │  │  ├─ 9.3.1
│  │  │  │  │  ├─ checksums
│  │  │  │  │  │  └─ checksums.lock
│  │  │  │  │  ├─ expanded
│  │  │  │  │  ├─ fileChanges
│  │  │  │  │  │  └─ last-build.bin
│  │  │  │  │  ├─ fileHashes
│  │  │  │  │  │  ├─ fileHashes.bin
│  │  │  │  │  │  └─ fileHashes.lock
│  │  │  │  │  ├─ gc.properties
│  │  │  │  │  └─ vcsMetadata
│  │  │  │  ├─ buildOutputCleanup
│  │  │  │  │  ├─ buildOutputCleanup.lock
│  │  │  │  │  └─ cache.properties
│  │  │  │  ├─ noVersion
│  │  │  │  │  └─ buildLogic.lock
│  │  │  │  └─ vcs-1
│  │  │  │     └─ gc.properties
│  │  │  ├─ app
│  │  │  │  ├─ build.gradle
│  │  │  │  ├─ debug.keystore
│  │  │  │  ├─ proguard-rules.pro
│  │  │  │  └─ src
│  │  │  │     ├─ debug
│  │  │  │     │  └─ AndroidManifest.xml
│  │  │  │     ├─ debugOptimized
│  │  │  │     │  └─ AndroidManifest.xml
│  │  │  │     └─ main
│  │  │  │        ├─ AndroidManifest.xml
│  │  │  │        ├─ java
│  │  │  │        │  └─ com
│  │  │  │        │     └─ baytalmosawer
│  │  │  │        │        └─ attendance
│  │  │  │        │           ├─ MainActivity.kt
│  │  │  │        │           └─ MainApplication.kt
│  │  │  │        └─ res
│  │  │  │           ├─ drawable
│  │  │  │           │  ├─ ic_launcher_background.xml
│  │  │  │           │  └─ rn_edit_text_material.xml
│  │  │  │           ├─ drawable-hdpi
│  │  │  │           │  └─ splashscreen_logo.png
│  │  │  │           ├─ drawable-mdpi
│  │  │  │           │  └─ splashscreen_logo.png
│  │  │  │           ├─ drawable-xhdpi
│  │  │  │           │  └─ splashscreen_logo.png
│  │  │  │           ├─ drawable-xxhdpi
│  │  │  │           │  └─ splashscreen_logo.png
│  │  │  │           ├─ drawable-xxxhdpi
│  │  │  │           │  └─ splashscreen_logo.png
│  │  │  │           ├─ mipmap-anydpi-v26
│  │  │  │           │  ├─ ic_launcher.xml
│  │  │  │           │  └─ ic_launcher_round.xml
│  │  │  │           ├─ mipmap-hdpi
│  │  │  │           │  ├─ ic_launcher.webp
│  │  │  │           │  ├─ ic_launcher_foreground.webp
│  │  │  │           │  └─ ic_launcher_round.webp
│  │  │  │           ├─ mipmap-mdpi
│  │  │  │           │  ├─ ic_launcher.webp
│  │  │  │           │  ├─ ic_launcher_foreground.webp
│  │  │  │           │  └─ ic_launcher_round.webp
│  │  │  │           ├─ mipmap-xhdpi
│  │  │  │           │  ├─ ic_launcher.webp
│  │  │  │           │  ├─ ic_launcher_foreground.webp
│  │  │  │           │  └─ ic_launcher_round.webp
│  │  │  │           ├─ mipmap-xxhdpi
│  │  │  │           │  ├─ ic_launcher.webp
│  │  │  │           │  ├─ ic_launcher_foreground.webp
│  │  │  │           │  └─ ic_launcher_round.webp
│  │  │  │           ├─ mipmap-xxxhdpi
│  │  │  │           │  ├─ ic_launcher.webp
│  │  │  │           │  ├─ ic_launcher_foreground.webp
│  │  │  │           │  └─ ic_launcher_round.webp
│  │  │  │           ├─ values
│  │  │  │           │  ├─ colors.xml
│  │  │  │           │  ├─ strings.xml
│  │  │  │           │  └─ styles.xml
│  │  │  │           └─ values-night
│  │  │  │              └─ colors.xml
│  │  │  ├─ build
│  │  │  │  └─ reports
│  │  │  │     └─ problems
│  │  │  │        └─ problems-report.html
│  │  │  ├─ build.gradle
│  │  │  ├─ gradle
│  │  │  │  └─ wrapper
│  │  │  │     ├─ gradle-wrapper.jar
│  │  │  │     └─ gradle-wrapper.properties
│  │  │  ├─ gradle.properties
│  │  │  ├─ gradlew
│  │  │  ├─ gradlew.bat
│  │  │  └─ settings.gradle
│  │  ├─ app.json
│  │  ├─ App.tsx
│  │  ├─ assets
│  │  │  ├─ adaptive-icon.png
│  │  │  ├─ brand
│  │  │  │  ├─ logo-lockup-black.png
│  │  │  │  ├─ logo-lockup-white.png
│  │  │  │  ├─ logo-mark-black.png
│  │  │  │  └─ logo-mark-white.png
│  │  │  ├─ icon.png
│  │  │  └─ splash-icon.png
│  │  ├─ index.ts
│  │  ├─ package-lock.json
│  │  ├─ package.json
│  │  ├─ src
│  │  │  ├─ api.ts
│  │  │  ├─ app-context.tsx
│  │  │  ├─ Auth.tsx
│  │  │  ├─ format.ts
│  │  │  ├─ Home.tsx
│  │  │  ├─ Login.tsx
│  │  │  ├─ messages.ts
│  │  │  ├─ MonthSwitcher.tsx
│  │  │  ├─ Profile.tsx
│  │  │  ├─ Records.tsx
│  │  │  ├─ Requests.tsx
│  │  │  ├─ styles.ts
│  │  │  ├─ Tasks.tsx
│  │  │  ├─ theme.ts
│  │  │  └─ ui.tsx
│  │  └─ tsconfig.json
│  └─ web
│     ├─ app
│     │  ├─ branches
│     │  │  └─ page.tsx
│     │  ├─ employees
│     │  │  └─ page.tsx
│     │  ├─ globals.css
│     │  ├─ holidays
│     │  │  └─ page.tsx
│     │  ├─ icon.png
│     │  ├─ layout.tsx
│     │  ├─ leaves
│     │  │  └─ page.tsx
│     │  ├─ login
│     │  │  └─ page.tsx
│     │  ├─ page.tsx
│     │  ├─ reports
│     │  │  └─ page.tsx
│     │  ├─ settings
│     │  │  ├─ devices.tsx
│     │  │  ├─ helpers.ts
│     │  │  ├─ page.tsx
│     │  │  ├─ policy
│     │  │  │  └─ page.tsx
│     │  │  ├─ tabs.tsx
│     │  │  └─ whatsapp.tsx
│     │  ├─ setup
│     │  │  └─ page.tsx
│     │  └─ tasks
│     │     └─ page.tsx
│     ├─ components
│     │  ├─ AuthFrame.tsx
│     │  ├─ ColorWheel.tsx
│     │  ├─ Logo.tsx
│     │  ├─ MapPicker.tsx
│     │  ├─ Nav.tsx
│     │  ├─ Providers.tsx
│     │  ├─ Shell.tsx
│     │  └─ ui.tsx
│     ├─ global.d.ts
│     ├─ lib
│     │  ├─ api.ts
│     │  ├─ errors.ts
│     │  ├─ format.ts
│     │  └─ session.ts
│     ├─ next-env.d.ts
│     ├─ next.config.js
│     ├─ package.json
│     ├─ public
│     │  └─ brand
│     │     ├─ logo-lockup-black.png
│     │     ├─ logo-lockup-white.png
│     │     ├─ logo-lockup.svg
│     │     ├─ logo-mark-black.png
│     │     ├─ logo-mark-white.png
│     │     ├─ logo-mark.svg
│     │     └─ README.txt
│     └─ tsconfig.json
├─ DECISIONS.md
├─ docker-compose.yml
├─ docs
│  └─ HR-CONFIGURATION.md
├─ package-lock.json
├─ package.json
├─ packages
│  └─ shared
│     ├─ package.json
│     ├─ src
│     │  ├─ checkin.test.ts
│     │  ├─ checkin.ts
│     │  ├─ dates.test.ts
│     │  ├─ engine.test.ts
│     │  ├─ engine.ts
│     │  ├─ geo.ts
│     │  ├─ index.ts
│     │  ├─ tasks.ts
│     │  └─ time.ts
│     └─ tsconfig.json
├─ README.md
└─ {packages
   └─ shared
      └─ src,apps
         └─ api
            └─ prisma}

```
