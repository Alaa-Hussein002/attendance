import { Translator } from '@attendance/i18n';

/** API error codes are language-neutral; the dictionary owns the sentence. */
export const msg = (code: string, t: Translator) => {
  const key = `err.${code}`;
  const text = t(key);
  return text === key ? t('common.generic_error') : text;
};

/** Neutral day states (holiday/weekend/leave…) with their colour; labels come from the dictionary. */
export const NEUTRAL: Record<string, { key: string; color: string }> = {
  HOLIDAY: { key: 'neutral.HOLIDAY', color: '#94a3b8' },
  WEEKEND: { key: 'neutral.WEEKEND', color: '#d8d4c9' },
  ON_LEAVE: { key: 'neutral.ON_LEAVE', color: '#6aa0f5' },
  EXCUSED: { key: 'neutral.EXCUSED', color: '#a78bfa' },
  FUTURE: { key: 'neutral.FUTURE', color: 'transparent' },
  INACTIVE: { key: 'neutral.INACTIVE', color: '#e5e2d9' },
};
