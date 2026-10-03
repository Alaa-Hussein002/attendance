const M: Record<string, string> = {
  INVALID_CREDENTIALS: 'بيانات الدخول غير صحيحة', ACCOUNT_LOCKED: 'الحساب مقفل مؤقتاً بسبب محاولات خاطئة، حاول بعد 15 دقيقة',
  OTP_RATE_LIMIT: 'تجاوزت عدد الرموز المسموح، حاول لاحقاً', INVALID_CODE: 'الرمز غير صحيح', EXPIRED: 'انتهت صلاحية الرمز', CONSUMED: 'الرمز مستخدم',
  TOO_MANY_ATTEMPTS: 'محاولات كثيرة، اطلب رمزاً جديداً', INVALID_CHALLENGE: 'الطلب غير صالح، أعد تسجيل الدخول',
  DEVICE_NOT_BOUND: 'جهازك غير مرتبط بالحساب، سجّل الدخول من جديد', DEVICE_MISMATCH: 'هذا ليس الجهاز المرتبط بحسابك',
  NOT_IN_LOCATION: 'لست داخل نطاق مقر العمل', MOCK_LOCATION: 'تم رصد موقع وهمي، لا يمكن تسجيل الحضور',
  TOO_LATE: 'انتهى وقت تسجيل الحضور، وسُجّل اليوم غياباً', ALREADY_CHECKED_IN: 'سجّلت حضورك اليوم مسبقاً',
  NO_VERIFICATION_MODE: 'لا توجد طريقة تحقق مفعّلة لفرعك، راجع الموارد البشرية', NO_BRANCH: 'حسابك غير مرتبط بفرع، راجع الموارد البشرية',
  SESSION_EXPIRED: 'انتهت الجلسة، سجّل الدخول من جديد', POLICY_NOT_CONFIGURED: 'لم تُضبط سياسة الحضور بعد',
};
export const msg = (code: string) => M[code] ?? 'حدث خطأ غير متوقع';
export const NEUTRAL: Record<string, { label: string; color: string }> = {
  HOLIDAY: { label: 'عطلة رسمية', color: '#94a3b8' }, WEEKEND: { label: 'عطلة أسبوعية', color: '#cbd5e1' },
  ON_LEAVE: { label: 'إجازة', color: '#60a5fa' }, EXCUSED: { label: 'معفى', color: '#a78bfa' }, FUTURE: { label: '—', color: 'transparent' },
};
