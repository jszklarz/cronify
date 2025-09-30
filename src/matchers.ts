import { WEEKDAYS_EN, MONTHS_EN } from "./locales/en.js";
import { parseTime, to24Hour } from "./parsers.js";
import type { ParsedTime } from "./types.js";
import type { LocaleConstants } from "./locales/index.js";

/**
 * Results from pattern matching against the input text.
 * Contains all extracted scheduling components that will be converted to cron fields.
 */
export interface MatchResults {
  /** Month numbers (1-12) extracted from the text (e.g., "january" -> 1) */
  selectedMonths: number[];
  /** Weekday numbers (0-6, 0=Sunday) extracted from the text (e.g., "monday" -> 1) */
  selectedWeekdays: number[];
  /** Day-of-month numbers (1-31) extracted from the text (e.g., "on the 15th" -> 15) */
  selectedMonthDays: number[];
  /** Parsed time expressions (e.g., "at 9am" -> {hour24: 9, minute: 0}) */
  parsedTimes: ParsedTime[];
  /** Hour range for time windows (e.g., "between 9am and 5pm" -> "9-17") */
  hourWindowRange: string | null;
  /** Interval for minute-based schedules (e.g., "every 15 minutes" -> 15) */
  everyNMinutes: number | null;
  /** Interval for hour-based schedules (e.g., "every 2 hours" -> 2) */
  everyNHours: number | null;
  /** Minute value for hourly schedules (e.g., "at :05 past every hour" -> 5) */
  atPastEachHour: number | null;
}

/**
 * Detects patterns that cannot be expressed in standard cron syntax.
 *
 * Standard cron has limitations around:
 * - Nth/last weekday of the month (e.g., "last Friday")
 * - Business day calculations
 * - Last day of month detection
 *
 * @param text - Normalized input text to check
 * @param locale - Optional locale constants for locale-specific pattern matching
 * @returns Error message if unsupported pattern found, null otherwise
 *
 * @example
 * ```typescript
 * detectUnsupportedPatterns("last friday of the month")
 * // => "Cron (standard) cannot express 'nth/last weekday of month'..."
 *
 * detectUnsupportedPatterns("every monday")
 * // => null
 * ```
 */
export function detectUnsupportedPatterns(text: string, locale?: LocaleConstants): string | null {
  const weekdayKeys = locale ? Object.keys(locale.weekdays).join('|') : 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';

  const nthWeekdayPattern = new RegExp(`(^|\\s|)(last|nth|first|second|third|fourth|último|primero|segundo|tercero|cuarto|最后|第一|第二|第三|第四)(\\s+|)(${weekdayKeys})`);
  if (nthWeekdayPattern.test(text)) {
    return "Cron (standard) cannot express 'nth/last weekday of month'. Use RRULE or Quartz.";
  }

  if (/\b(business\s*days?)\b/.test(text)) {
    return "'Business days' and holiday calendars are beyond plain cron. Use RRULE + calendar exceptions.";
  }

  if (/\b(last\s+day\s+of\s+the\s+month|eom|end\s+of\s+month|último\s+día\s+del\s+mes|fin\s+de\s+mes)\b/.test(text)) {
    return "'Last day of month' is not in standard cron. Use Quartz L or emit 28-31 with guard logic.";
  }

  return null;
}

/**
 * Extracts all scheduling patterns from normalized input text.
 *
 * Scans the input for various schedule components including:
 * - Months (e.g., "january", "aug")
 * - Weekdays (e.g., "monday", "fri")
 * - Days of month (e.g., "on the 15th")
 * - Times (e.g., "at 9am", "at 5:30pm")
 * - Intervals (e.g., "every 15 minutes", "every 2 hours")
 * - Time windows (e.g., "between 9am and 5pm")
 * - Special patterns (e.g., "quarterly")
 *
 * @param normalizedText - Lowercased, whitespace-normalized input text
 * @returns Object containing all matched scheduling components
 *
 * @example
 * ```typescript
 * matchPatterns("every monday at 9am")
 * // => {
 * //   selectedWeekdays: [1],
 * //   parsedTimes: [{hour24: 9, minute: 0}],
 * //   selectedMonths: [],
 * //   ...
 * // }
 * ```
 */
export function matchPatterns(normalizedText: string, locale?: LocaleConstants): MatchResults {
  const weekdays = locale?.weekdays ?? WEEKDAYS_EN;
  const months = locale?.months ?? MONTHS_EN;

  const selectedMonths: number[] = [];
  const selectedWeekdays: number[] = [];
  const selectedMonthDays: number[] = [];

  // Months (e.g., "in aug", "every jan and feb")
  for (const monthKey of Object.keys(months)) {
    if (
      normalizedText.includes(` ${monthKey} `) ||
      normalizedText.endsWith(` ${monthKey}`) ||
      normalizedText.startsWith(`${monthKey} `)
    ) {
      selectedMonths.push(months[monthKey]);
    }
  }
  if (/\bquarter(ly)?\b/.test(normalizedText)) {
    selectedMonths.push(1, 4, 7, 10);
  }

  // Weekdays - handle both word-bounded and non-bounded (for CJK languages)
  const weekdayKeys = Object.keys(weekdays).join('|');
  // Use word boundaries for ASCII, but allow matching without boundaries for CJK
  const weekdayRegex = new RegExp(`(${weekdayKeys})`, 'g');
  const weekdayMatches = [...normalizedText.matchAll(weekdayRegex)];

  if (weekdayMatches.length) {
    weekdayMatches.forEach((match) =>
      selectedWeekdays.push(weekdays[match[1]]),
    );
  }

  // Day of month (e.g., "on the 1st and 15th")
  const dayOfMonthMatches = [
    ...normalizedText.matchAll(/\bon\s+the\s+(\d{1,2})(st|nd|rd|th)?\b/g),
  ];
  if (dayOfMonthMatches.length) {
    dayOfMonthMatches.forEach((match) =>
      selectedMonthDays.push(parseInt(match[1], 10)),
    );
  }

  // Every N minutes/hours - support English, Spanish, and Chinese
  const everyPattern = locale ? `(${locale.keywords.every.join('|')})` : 'every';
  const minutePattern = locale ? `(${locale.keywords.minute.join('|')})` : 'minutes?';
  const hourPattern = locale ? `(${locale.keywords.hour.join('|')})` : 'hours?';

  // Standard pattern with spaces: "every 15 minutes" or "cada 15 minutos"
  const everyNMinutesPattern = new RegExp(`${everyPattern}\\s*(\\d+)\\s*${minutePattern}`);
  const everyNMinutesMatch = normalizedText.match(everyNMinutesPattern);
  const everyNMinutes = everyNMinutesMatch
    ? Math.max(1, Math.min(59, parseInt(everyNMinutesMatch[2], 10)))
    : null;

  const everyNHoursPattern = new RegExp(`${everyPattern}\\s*(\\d+)\\s*${hourPattern}`);
  const everyNHoursMatch = normalizedText.match(everyNHoursPattern);
  const everyNHours = everyNHoursMatch
    ? Math.max(1, Math.min(23, parseInt(everyNHoursMatch[2], 10)))
    : null;

  // "at :mm past every hour"
  const atPastEachHourMatch = normalizedText.match(
    /\bat\s*:(\d{2})\s*(past\s+)?(each|every)\s+hour\b/,
  );
  const atPastEachHour = atPastEachHourMatch
    ? parseInt(atPastEachHourMatch[1], 10)
    : null;

  // Time windows: "between 9am and 5pm" or "entre las 9am y 5pm"
  const betweenPattern = locale ? `(${locale.keywords.between.join('|')})` : 'between';
  const andPattern = locale ? `(${locale.keywords.and.join('|')})` : 'and';
  const betweenWindowPattern = new RegExp(
    `\\b${betweenPattern}\\s+(?:las\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?\\s+${andPattern}\\s+(?:las\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?\\b`
  );
  const betweenWindowMatch = normalizedText.match(betweenWindowPattern);
  let hourWindowRange: string | null = null;
  if (betweenWindowMatch) {
    const startHour = to24Hour(
      parseInt(betweenWindowMatch[2], 10),
      betweenWindowMatch[4] as "am" | "pm" | undefined,
    );
    const endHour = to24Hour(
      parseInt(betweenWindowMatch[6], 10),
      betweenWindowMatch[8] as "am" | "pm" | undefined,
    );
    const windowStart = Math.min(startHour, endHour);
    const windowEnd = Math.max(startHour, endHour);
    hourWindowRange = `${windowStart}-${windowEnd}`;
  }

  // Specific time(s): "at 5pm", "at 9:30am", "every monday at 9am" or "a las 5pm" or "上午9点"
  const atPattern = locale ? `(${locale.keywords.at.join('|')})` : 'at';

  // Chinese time pattern: catches "上午9点", "下午5点30分", "9点", "零点", "中午", "午夜"
  const chineseTimePattern = /(零点|午夜|凌晨|中午|正午|(上午|下午)?(\d{1,2})点(\d{1,2})?分?)/g;
  const chineseTimeMatches = [...normalizedText.matchAll(chineseTimePattern)];
  const chineseParsedTimes = chineseTimeMatches
    .map((match) => parseTime(match[0]))
    .filter(Boolean) as ParsedTime[];

  // Western time pattern
  const timePattern = new RegExp(`${atPattern}\\s+((?:la\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?)`, 'g');
  const explicitTimePhrases = [...normalizedText.matchAll(timePattern)];
  const westernParsedTimes = explicitTimePhrases
    .map((match) => parseTime(match[2]))
    .filter(Boolean) as ParsedTime[];

  const parsedTimes = [...chineseParsedTimes, ...westernParsedTimes];

  return {
    selectedMonths,
    selectedWeekdays,
    selectedMonthDays,
    parsedTimes,
    hourWindowRange,
    everyNMinutes,
    everyNHours,
    atPastEachHour,
  };
}