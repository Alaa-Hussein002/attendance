# النشر الحقيقي على Hostinger + المتاجر

هذا الملف هو خطة التنفيذ الفعلية. لا يحتوي أي كلمات مرور أو مفاتيح.

## 1) ما أحتاجه منك قبل البدء

| # | المعلومة | لماذا |
|---|---|---|
| 1 | **اسم الدومين بالضبط** (مثال: `baytalmosawer.com`) | ربط الموقع و`api.<الدومين>` |
| 2 | **اسم الباقة الظاهر في hPanel** (Business / Unlimited / Cloud / VPS) | يحدد هل Node.js وPostgreSQL متاحان |
| 3 | **وصول hPanel**: إنشاء مستخدم نشر منفصل بصلاحية المواقع وDNS، أو تنفيذ الخطوات معي | لا يمكن رفع الملفات أو تعديل DNS بدون وصول |
| 4 | **قرار قاعدة البيانات**: VPS + PostgreSQL داخلي، أو Business + Supabase/Neon | التطبيق لا يعمل على MySQL |
| 5 | **حساب Google Play Console** وحساب **Apple Developer Program** | نشر التطبيق في المتجرين |
| 6 | **بريد الشركة ورقم الدعم** والاسم القانوني الكامل | سياسة الخصوصية وصفحة الدعم وبيانات المتجر |

> لا ترسل كلمات المرور في المحادثة إن لم تكن مرتاحًا. الأفضل إنشاء مستخدم منفصل لي في hPanel، أو أن تنفّذ الخطوات وأنا أعطيك الأوامر خطوة بخطوة.

---

## 2) القرار المعماري

التطبيق: `Next.js` للويب + `NestJS/Prisma` للـ API + `PostgreSQL`.
الباقة المشتركة Business عادةً توفّر MySQL فقط، وليس PostgreSQL. لذلك أمامنا مساران:

### المسار الموصى به: VPS من Hostinger + Docker

- كل شيء على حساب Hostinger نفسه: الويب + API + PostgreSQL + SSL.
- لا حاجة لخدمة قاعدة بيانات خارجية.
- أسهل في الصيانة والنسخ الاحتياطي والتحديث.
- يحتاج ترقية/إضافة VPS (KVM 1 بحد أدنى، وKVM 2 أفضل لبناء Next.js).

### المسار الاقتصادي: Business الحالي + PostgreSQL مُدار خارجي

- نحتاج التأكد أولًا أن باقتك تسمح بتشغيل Node.js (أو إضافة Node.js Hosting).
- قاعدة البيانات على Supabase أو Neon (خطة مجانية للبداية، ثم مدفوعة).
- الويب والـ API كتطبيقين Node.js منفصلين، مع نطاقين فرعيين.
- مخاطرة إضافية: حدود الذاكرة أثناء البناء، وإعدادات Prisma مع Connection Pooler.

**لا أنصح بتحويل التطبيق إلى MySQL** لأنه يعتمد على مصفوفات PostgreSQL وEnums وJson؛ التحويل سيكسر بيانات وسلوكيات قائمة.

---

## 3) DNS المطلوب

بعد تحديد الدومين:

| النوع | الاسم | القيمة |
|---|---|---|
| A | `@` | عنوان IP الخاص بالخادم |
| A | `api` | عنوان IP الخاص بالخادم |
| CNAME | `www` | `@` |

- SSL تلقائي عبر Caddy أو Let's Encrypt.
- لا نفعّل Cloudflare Proxy قبل التأكد من إعدادات SSL، لتجنب حلقات إعادة التوجيه.

---

## 4) متغيرات الإنتاج

### API (`apps/api`)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://attendance:CHANGE_ME@db:5432/attendance
JWT_SECRET=CHANGE_ME_MIN_32_RANDOM_CHARS
CORS_ORIGINS=https://<DOMAIN>
SETUP_KEY=CHANGE_ME_RANDOM
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM_NAME=شركة بيت المصور
```

- `JWT_SECRET`: 64 حرفًا عشوائيًا على الأقل.
- `SETUP_KEY`: يمنع أي شخص من تشغيل معالج الإعداد الأول.
- `SMTP_PASS`: كلمة مرور تطبيق من مزوّد البريد، وليس كلمة مرور الحساب.

### الويب (`apps/web`)

```env
NEXT_PUBLIC_API_URL=https://api.<DOMAIN>
```

> `NEXT_PUBLIC_API_URL` يُبنى داخل حزمة الويب، لذلك يجب ضبطه **قبل** `next build`، وليس بعده.

### التطبيق (`apps/mobile`)

```env
EXPO_PUBLIC_API_URL=https://api.<DOMAIN>
```

يُضبط في EAS قبل البناء:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://api.<DOMAIN> --environment production --visibility plaintext
```

---

## 5) خطوات VPS (مختصرة)

على Ubuntu 24.04:

```bash
# 1) تثبيت Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2) جلب المشروع
sudo mkdir -p /opt/attendance && sudo chown $USER:$USER /opt/attendance
git clone https://github.com/Alaa-Hussein002/attendance.git /opt/attendance
cd /opt/attendance

# 3) ملف البيئة
cp deploy/.env.example deploy/.env
# عدّل القيم، ثم:
docker compose -f deploy/docker-compose.prod.yml up -d --build

# 4) قاعدة البيانات
docker compose -f deploy/docker-compose.prod.yml exec api npx prisma migrate deploy

# 5) فتح الموقع
# https://<DOMAIN>/setup  (أدخل SETUP_KEY)
```

- الجدار الناري: `22`, `80`, `443` فقط.
- نسخة احتياطية يومية: `pg_dump` إلى مجلد خارج الخادم.
- تحديث لاحق: `git pull && docker compose -f deploy/docker-compose.prod.yml up -d --build`.

> ملفات `deploy/docker-compose.prod.yml` و`deploy/Caddyfile` و`deploy/.env.example` جاهزة في المستودع.

---

## 6) خطوات Business + Supabase (بديل)

1. تأكد من وجود **Node.js** في hPanel. إن لم يكن، أضف Node.js Hosting أو اختر VPS.
2. أنشئ مشروع Supabase في أقرب منطقة (Frankfurt مثلًا).
3. انسخ Connection String. لـ Prisma:
   - استخدم **Session Pooler** أو اتصالًا مباشرًا يدعم Prepared Statements.
   - أضف `directUrl` في `schema.prisma` إذا استخدمنا Pooler.
4. ارفع الويب كتطبيق Node.js على الدومين الرئيسي:
   - Build: `npm install && npm run build -w @attendance/web`
   - Start: `npm run start -w @attendance/web`
5. ارفع API كتطبيق Node.js على `api.<DOMAIN>`:
   - Build: `npm install && npm run build -w @attendance/api`
   - Start: `npm run start -w @attendance/api`
6. نفّذ `npx prisma migrate deploy` مرة واحدة عبر SSH.
7. اضبط `NEXT_PUBLIC_API_URL` وأعد بناء الويب.

**تحذير:** المشروع Monorepo، وحزم `@attendance/shared` و`@attendance/i18n` محلية. يجب أن يكون جذر التطبيق في Hostinger هو جذر المستودع، أو ننشئ حزمة نشر مستقلة. هذا يحتاج تجربة فعلية على الاستضافة.

---

## 7) نشر التطبيق في المتاجر

### الحسابات

- **Google Play Console**: 25 دولارًا مرة واحدة + التحقق من الهوية (قد يستغرق أيامًا).
- **Apple Developer Program**: 99 دولارًا سنويًا + التحقق (قد يستغرق 48 ساعة).
- **Expo/EAS**: حساب مجاني، ويفضل خطة مدفوعة لبناء iOS بسرعة.

### المطلوب في المتجرين

- [ ] أيقونة 1024×1024.
- [ ] صور شاشات (Play: 2–8 صور؛ Apple: مقاسات 6.7" و6.5" و5.5").
- [ ] Feature Graphic 1024×500 لـ Google Play.
- [ ] وصف عربي وإنجليزي قصير وطويل.
- [ ] سياسة خصوصية على رابط عام: `https://<DOMAIN>/privacy`.
- [ ] شروط الاستخدام: `https://<DOMAIN>/terms`.
- [ ] صفحة دعم/تواصل: `https://<DOMAIN>/support`.
- [ ] حساب تجريبي للمراجعين (بريد + كلمة مرور).
- [ ] Data Safety (Google) وApp Privacy (Apple): الموقع، الاسم، البريد، الهاتف، معرّف الجهاز، سجلات الحضور.
- [ ] تصريح التشفير (Apple): يستخدم HTTPS فقط.
- [ ] **حذف الحساب**: Google وApple يطلبان مسارًا داخل التطبيق + رابط ويب. هذا غير موجود حاليًا ويجب إضافته قبل التقديم.
- [ ] توضيح أن التطبيق B2B لموظفي الشركة، مع حساب تجريبي، لتجنب الرفض.

### أوامر البناء

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform android --profile production
npx eas-cli submit --platform ios --profile production
```

`eas.json` الحالي يحتوي قيمًا مؤقتة (`appleId`, `ascAppId`, `appleTeamId`) ويجب استبدالها بالبيانات الحقيقية.

---

## 8) ما سأنجزه فور وصول البيانات

1. ضبط DNS وSSL للدومين و`api.<DOMAIN>`.
2. إنشاء قاعدة بيانات الإنتاج وتشغيل الترحيلات.
3. رفع الويب والـ API واختبار تسجيل الدخول والحضور والمهام.
4. إضافة صفحات الخصوصية والشروط والدعم وحذف الحساب (عربي/إنجليزي).
5. تجهيز EAS وبناء AAB/IPA ورفعها للمتاجر مع بيانات المتجر.
6. تسليم روابط نهائية + بيانات دخول المدير + تقرير اختبار.

---

## 9) ملاحظات أمنية

- لا ترفع `apps/api/.env` أو أي ملف مفاتيح إلى Git. المستودع عام (public).
- استخدم أسرارًا جديدة للإنتاج، ولا تعِد استخدام كلمة مرور SMTP الحالية في الكود.
- فعّل `SETUP_KEY` قبل فتح الموقع للعامة.
- قيّد `CORS_ORIGINS` على دومين الويب فقط؛ تطبيق الجوال لا يرسل Origin.
- خذ نسخة احتياطية من قاعدة البيانات قبل أي ترحيل.
- **Next.js 14.2** عليه تنبيهات أمنية حديثة. قبل الإطلاق العام: ترقية إلى Next 15/16 (يحتاج تعديل `cookies()`/`headers()` لتصبح async)، أو كحد أدنى تعطيل `next/image` optimizer وإغلاق المسارات غير المستخدمة. لا نطلق نسخة قديمة على الإنترنت بدون معالجة ذلك.
