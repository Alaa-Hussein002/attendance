/** Shared types for @attendance/i18n. Kept in their own file so the dictionaries can import them without a cycle. */

export type Locale = 'ar' | 'en';

/** CLDR plural forms. English uses one/other; Arabic uses one/two/few/many/other. */
export type Plural = { one: string; two?: string; few?: string; many?: string; other: string };

/** A message is a plain sentence, or a set of plural forms chosen by the {count} variable. */
export type MsgValue = string | Plural;
