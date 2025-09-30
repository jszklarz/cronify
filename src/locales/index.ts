import { WEEKDAYS_EN, MONTHS_EN, KEYWORDS_EN } from './en.js';
import { WEEKDAYS_ES, MONTHS_ES, KEYWORDS_ES } from './es.js';
import { WEEKDAYS_ZH, MONTHS_ZH, KEYWORDS_ZH } from './zh.js';

export interface LocaleConstants {
  weekdays: Record<string, number>;
  months: Record<string, number>;
  keywords: typeof KEYWORDS_EN;
}

const LOCALES: Record<string, LocaleConstants> = {
  en: {
    weekdays: WEEKDAYS_EN,
    months: MONTHS_EN,
    keywords: KEYWORDS_EN,
  },
  es: {
    weekdays: WEEKDAYS_ES,
    months: MONTHS_ES,
    keywords: KEYWORDS_ES,
  },
  zh: {
    weekdays: WEEKDAYS_ZH,
    months: MONTHS_ZH,
    keywords: KEYWORDS_ZH,
  },
};

export function getLocale(locale: string): LocaleConstants {
  const normalized = locale.toLowerCase().split('-')[0]; // 'es-MX' -> 'es'
  return LOCALES[normalized] ?? LOCALES.en;
}

export type SupportedLocale = keyof typeof LOCALES;