const M: Record<string, string> = {
  INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحة', ACCOUNT_LOCKED: 'تم إيقاف الدخول مؤقتاً بعد محاولات خاطئة. حاول بعد 15 دقيقة',
  OTP_RATE_LIMIT: 'طلبتَ رموزاً كثيرة. حاول بعد ساعة', INVALID_CODE: 'الرمز غير صحيح', EXPIRED: 'انتهت صلاحية الرمز، اطلب رمزاً جديداً', CONSUMED: 'هذا الرمز استُخدم من قبل',
  TOO_MANY_ATTEMPTS: 'محاولات خاطئة كثيرة، اطلب رمزاً جديداً', INVALID_CHALLENGE: 'انتهت جلسة التحقق، أعد تسجيل الدخول', EMAIL_SEND_FAILED: 'تعذر إرسال البريد، حاول لاحقاً',
  COMPANY_CODE_REQUIRED: 'أدخل رمز الشركة', INVALID_CHANGE_TOKEN: 'انتهت مهلة تغيير كلمة المرور، سجّل الدخول من جديد',
  PASSWORD_TOO_SHORT: 'كلمة المرور يجب ألا تقل عن 8 خانات', PASSWORD_IS_DEFAULT: 'اختر كلمة مرور غير الافتراضية', PASSWORD_NEEDS_LETTER_AND_DIGIT: 'كلمة المرور تحتاج حرفاً ورقماً', PASSWORD_TOO_SIMPLE: 'كلمة المرور بسيطة جداً',
  DEVICE_NOT_BOUND: 'جهازك غير مرتبط بالحساب، سجّل الدخول من جديد', DEVICE_MISMATCH: 'هذا ليس الجهاز المرتبط بحسابك', DEVICE_REVOKED: 'تم فك ارتباط هذا الجهاز، سجّل الدخول من جديد',
  NOT_IN_LOCATION: 'لست داخل نطاق مقر العمل', MOCK_LOCATION: 'تم رصد موقع وهمي، لا يمكن تسجيل الحضور', TOO_LATE: 'انتهى وقت تسجيل الحضور وسُجّل اليوم غياباً', ALREADY_CHECKED_IN: 'سجّلت حضورك اليوم مسبقاً',
  NO_VERIFICATION_MODE: 'لا توجد طريقة تحقق مفعّلة لفرعك، راجع الموارد البشرية', NO_BRANCH: 'حسابك غير مرتبط بفرع، راجع الموارد البشرية', NOT_TRACKED: 'هذا الحساب لا يسجّل حضوراً',
  SESSION_EXPIRED: 'انتهت الجلسة، سجّل الدخول من جديد', POLICY_NOT_CONFIGURED: 'لم تُضبط سياسة الحضور بعد',
  NETWORK_ERROR: 'تعذر الاتصال بالخادم. تأكد من الشبكة وأن عنوان الخادم صحيح', REASON_REQUIRED: 'اكتب السبب (3 أحرف على الأقل)', DATE_IN_FUTURE: 'لا يمكن اختيار تاريخ مستقبلي',
  DATE_TOO_OLD: 'لا يمكن تقديم عذر لأكثر من 31 يوماً مضت', REQUEST_EXISTS: 'قدّمت طلباً لهذا اليوم مسبقاً', LEAVE_OVERLAP: 'يتداخل مع إجازة أخرى', INVALID_RANGE: 'نطاق التواريخ غير صالح',
};
export const msg = (code: string) => M[code] ?? 'حدث خطأ غير متوقع. حاول مرة أخرى';
export const NEUTRAL: Record<string, { label: string; color: string }> = {
  HOLIDAY: { label: 'عطلة رسمية', color: '#94a3b8' }, WEEKEND: { label: 'عطلة أسبوعية', color: '#d8d4c9' }, ON_LEAVE: { label: 'إجازة', color: '#6aa0f5' }, EXCUSED: { label: 'معفى بعذر', color: '#a78bfa' }, FUTURE: { label: '—', color: 'transparent' },
};
