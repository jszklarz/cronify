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

  const nthWeekdayPattern = new RegExp(`(^|\\s|)(last|nth|first|second|third|fourth|primer|segundo|tercer|cuarto|quinto|último|primero|tercero|最后|第一|第二|第三|第四)(一个|个|o)?(\\s+|)(${weekdayKeys})`);
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
  // Quarterly - support locale-specific keywords
  const quarterlyPattern = locale
    ? new RegExp(`(${locale.keywords.quarterly.join('|')})`)
    : /\bquarter(ly)?\b/;
  if (quarterlyPattern.test(normalizedText)) {
    selectedMonths.push(1, 4, 7, 10);
  }

  // Weekdays - handle both word-bounded and non-bounded (for CJK languages)
  const weekdayKeys = Object.keys(weekdays).join('|');

  // Check for Spanish/Portuguese weekday ranges first: "de lunes a viernes" or "del lunes al viernes"
  const weekdayRangePattern = new RegExp(`\\b(de|del)\\s+(${weekdayKeys})\\s+(a|al)\\s+(${weekdayKeys})\\b`);
  const rangeMatch = normalizedText.match(weekdayRangePattern);

  if (rangeMatch) {
    const startDay = weekdays[rangeMatch[2]];
    const endDay = weekdays[rangeMatch[4]];
    // Add all days in the range
    if (startDay <= endDay) {
      for (let d = startDay; d <= endDay; d++) {
        selectedWeekdays.push(d);
      }
    } else {
      // Wrap around (e.g., Friday to Monday)
      for (let d = startDay; d <= 6; d++) selectedWeekdays.push(d);
      for (let d = 0; d <= endDay; d++) selectedWeekdays.push(d);
    }
  } else {
    // Individual weekday matching
    const weekdayRegex = new RegExp(`(${weekdayKeys})`, 'g');
    const weekdayMatches = [...normalizedText.matchAll(weekdayRegex)];

    if (weekdayMatches.length) {
      weekdayMatches.forEach((match) =>
        selectedWeekdays.push(weekdays[match[1]]),
      );
    }
  }

  // Day of month (e.g., "on the 1st and 15th", "el 15 de enero", "el día 15")
  const dayOfMonthMatches = [
    ...normalizedText.matchAll(/\bon\s+the\s+(\d{1,2})(st|nd|rd|th)?\b/g),
    ...normalizedText.matchAll(/\b(el|los)\s+(día\s+)?(\d{1,2})(º|o)?\b/g),
  ];
  if (dayOfMonthMatches.length) {
    dayOfMonthMatches.forEach((match) => {
      // For English pattern, day is in capture group 1
      // For Spanish pattern, day is in capture group 3
      const day = match[1] && /^\d/.test(match[1]) ? match[1] : match[3];
      if (day) selectedMonthDays.push(parseInt(day, 10));
    });
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

  // Chinese time pattern: catches "上午9点", "下午5点30分", "晚上8点", "9点半", "零点", "中午", "午夜"
  // Priority: explicit time with digits first, then standalone keywords
  const chineseExplicitTimePattern = /(上午|下午|晚上|傍晚|夜间|早上)?(\d{1,2})点(半|(\d{1,2})分?)?/g;
  const chineseKeywordTimePattern = /(零点|午夜|凌晨|中午|正午)/g;

  const explicitMatches = [...normalizedText.matchAll(chineseExplicitTimePattern)];
  const keywordMatches = [...normalizedText.matchAll(chineseKeywordTimePattern)];

  // Only use keyword matches if no explicit time was found nearby (within 4 chars)
  // This prevents duplicates like "中午12点半" matching both "中午" and "12点半"
  const filteredKeywords = keywordMatches.filter(kwMatch => {
    return !explicitMatches.some(exMatch => {
      const kwStart = kwMatch.index!;
      const kwEnd = kwStart + kwMatch[0].length;
      const exStart = exMatch.index!;
      const exEnd = exStart + exMatch[0].length;
      // Check if ranges overlap or are within 2 chars of each other
      return (kwStart <= exEnd + 2 && kwEnd >= exStart - 2);
    });
  });

  const chineseParsedTimes = [
    ...explicitMatches.map(m => parseTime(m[0])),
    ...filteredKeywords.map(m => parseTime(m[0]))
  ].filter(Boolean) as ParsedTime[];

  // Western time pattern (includes Spanish "de la" markers and decimal separator)
  const timePattern = new RegExp(`${atPattern}\\s+(((?:la\\s+)?\\d{1,2})(?:[.:]\\d{2})?\\s*(?:am|pm|de\\s+la\\s+(?:mañana|madrugada|tarde|noche))?)`, 'g');
  const explicitTimePhrases = [...normalizedText.matchAll(timePattern)];
  const westernParsedTimes = explicitTimePhrases
    .map((match) => parseTime(match[2])) // Parse the full time expression
    .filter(Boolean) as ParsedTime[];

  // Also catch standalone Spanish time patterns without "a las"
  const spanishTimePattern = /\b(\d{1,2})(?:[.:](\d{2}))?\s*(?:de\s+la\s+)?(mañana|madrugada|tarde|noche)\b/g;
  const spanishTimeMatches = [...normalizedText.matchAll(spanishTimePattern)];
  const spanishParsedTimes = spanishTimeMatches
    .map((match) => parseTime(match[0]))
    .filter(Boolean) as ParsedTime[];

  const parsedTimes = [...chineseParsedTimes, ...westernParsedTimes, ...spanishParsedTimes];

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