export class ApiError extends Error { constructor(public code: string, public status: number, public data?: any) { super(code); } }

const AR_FALLBACK: Record<string, string> = {
  INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  NETWORK_ERROR: 'تعذر الاتصال بالخادم. تأكد أنه يعمل ثم أعد المحاولة',
};

/** Resolve an error to a user-facing message. Pass the translator `t` for bilingual output; otherwise Arabic is used. */
export const errText = (e: unknown, t?: (key: string) => string): string => {
  if (e instanceof ApiError) {
    const code = e.code;
    if (t) return t(`err.${code}`);
    return AR_FALLBACK[code] ?? 'حدث خطأ غير متوقع. حاول مرة أخرى';
  }
  return t ? t('common.generic_error') : 'حدث خطأ غير متوقع. حاول مرة أخرى';
};
