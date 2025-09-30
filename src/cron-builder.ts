import type { MatchResults } from "./matchers.js";
import type { LocaleConstants } from "./locales/index.js";

/**
 * Converts a list of numbers to a cron field expression.
 *
 * Handles deduplication, sorting, and special cases:
 * - Empty list -> "*" (or "0" if allowStar is false)
 * - Full range -> "*" (e.g., all 12 months)
 * - Otherwise -> comma-separated list (e.g., "1,3,5")
 *
 * @param numberList - Array of numbers to convert
 * @param maxValue - Maximum possible count for this field (e.g., 12 for months)
 * @param allowStar - Whether to return "*" for empty lists (default: true)
 * @returns Cron field string
 *
 * @example
 * ```typescript
 * listToCron([1, 3, 5], 7)    // => "1,3,5"
 * listToCron([1,2,3,4,5,6,7], 7) // => "*"
 * listToCron([], 12)          // => "*"
 * listToCron([], 12, false)   // => "0"
 * ```
 */
export function listToCron(
  numberList: number[] | null,
  maxValue: number,
  allowStar = true,
): string {
  if (!numberList || numberList.length === 0) return allowStar ? "*" : "0";
  const uniqueSorted = [...new Set(numberList)].sort((a, b) => a - b);
  if (uniqueSorted.length === maxValue) return "*";
  return uniqueSorted.join(",");
}

/**
 * The five fields of a standard cron expression.
 * Format: minute hour dayOfMonth month dayOfWeek
 */
export interface CronFields {
  /** Minute field (0-59, or *, or *\/N) */
  minute: string;
  /** Hour field (0-23, or *, or *\/N) */
  hour: string;
  /** Day of month field (1-31, or *, or *\/N) */
  dayOfMonth: string;
  /** Month field (1-12, or *, or *\/N) */
  month: string;
  /** Day of week field (0-6, 0=Sunday, or *, or *\/N) */
  dayOfWeek: string;
}

/**
 * Builds cron fields from matched patterns and input text.
 *
 * Applies various scheduling rules and heuristics to convert natural language
 * patterns into cron field values. Handles:
 * - Time-based patterns (intervals, specific times, time windows)
 * - Frequency patterns (daily, weekly, monthly, etc.)
 * - Day selection (weekdays, specific days of month)
 * - Month selection
 * - Special keywords (midnight, noon, hourly, etc.)
 *
 * @param normalizedText - Lowercased, normalized input text (for pattern matching)
 * @param matches - Extracted scheduling components from pattern matching
 * @param locale - Optional locale constants for locale-specific keyword matching
 * @returns Object with five cron field strings
 *
 * @example
 * ```typescript
 * buildCronFields("every monday at 9am", {
 *   selectedWeekdays: [1],
 *   parsedTimes: [{hour24: 9, minute: 0}],
 *   ...
 * })
 * // => { minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "1" }
 * ```
 */
export function buildCronFields(
  normalizedText: string,
  matches: MatchResults,
  locale?: LocaleConstants,
): CronFields {
  let minuteField: string = "*";
  let hourField: string = "*";
  let dayOfMonthField: string = "*";
  let monthField: string = "*";
  let dayOfWeekField: string = "*";

  // Build locale-aware regex patterns (no word boundaries for CJK languages)
  const weekdayPattern = locale
    ? new RegExp(`(${locale.keywords.weekday.join('|')})`)
    : /\bweekdays?\b/;
  const weekendPattern = locale
    ? new RegExp(`(${locale.keywords.weekend.join('|')})`)
    : /\bweekends?\b/;

  // Months
  if (matches.selectedMonths.length) {
    monthField = listToCron(matches.selectedMonths, 12);
  }

  // Weekdays
  if (weekdayPattern.test(normalizedText)) dayOfWeekField = "1-5";
  if (weekendPattern.test(normalizedText)) dayOfWeekField = "0,6";
  if (matches.selectedWeekdays.length) {
    dayOfWeekField = listToCron(matches.selectedWeekdays, 7);
  }

  // Day of month
  if (matches.selectedMonthDays.length) {
    dayOfMonthField = listToCron(matches.selectedMonthDays, 31);
  }

  // Every N minutes/hours
  if (matches.everyNMinutes !== null) {
    minuteField = `*/${matches.everyNMinutes}`;
  }
  if (matches.everyNHours !== null) {
    hourField = `*/${matches.everyNHours}`;
    if (minuteField === "*") minuteField = "0";
  }

  // Simple recurring patterns without numbers
  const everyPattern = locale ? `(${locale.keywords.every.join('|')})` : 'every';
  const minuteKeywordPattern = locale ? `(${locale.keywords.minute.join('|')})` : 'minute';
  const hourKeywordPattern = locale ? `(${locale.keywords.hour.join('|')})` : 'hour';
  const dayKeywordPattern = locale ? `(${locale.keywords.day.join('|')})` : 'day';
  const weekKeywordPattern = locale ? `(${locale.keywords.week.join('|')})` : 'week';
  const monthKeywordPattern = locale ? `(${locale.keywords.month.join('|')})` : 'month';

  const everyMinutePattern = new RegExp(`\\b${everyPattern}\\s+${minuteKeywordPattern}\\b`);
  const everyHourPattern = new RegExp(`\\b${everyPattern}\\s+${hourKeywordPattern}\\b`);
  const everyDayPattern = new RegExp(`\\b${everyPattern}\\s+${dayKeywordPattern}\\b`);
  const everyWeekPattern = new RegExp(`\\b${everyPattern}\\s+${weekKeywordPattern}\\b`);
  const everyMonthPattern = new RegExp(`\\b${everyPattern}\\s+${monthKeywordPattern}\\b`);

  if (everyMinutePattern.test(normalizedText)) {
    minuteField = "*";
    hourField = "*";
  }
  if (everyHourPattern.test(normalizedText)) {
    minuteField = "0";
    hourField = "*";
  }
  if (everyDayPattern.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
  }
  if (everyWeekPattern.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
    dayOfWeekField = "0";
  }
  if (everyMonthPattern.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
    dayOfMonthField = "1";
  }

  // Simple frequency words (no word boundaries for CJK languages)
  const hourlyPattern = locale ? new RegExp(`(${locale.keywords.hourly.join('|')})`) : /\bhourly\b/;
  const dailyPattern = locale ? new RegExp(`(${locale.keywords.daily.join('|')})`) : /\bdaily\b/;
  const weeklyPattern = locale ? new RegExp(`(${locale.keywords.weekly.join('|')})`) : /\bweekly\b/;
  const monthlyPattern = locale ? new RegExp(`(${locale.keywords.monthly.join('|')})`) : /\bmonthly\b/;

  if (hourlyPattern.test(normalizedText) && minuteField === "*") {
    minuteField = "0";
    hourField = "*";
  }
  if (dailyPattern.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
  }
  if (weeklyPattern.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
    dayOfWeekField = "0";
  }
  if (monthlyPattern.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
    dayOfMonthField = "1";
  }

  // "at :mm past every hour"
  if (matches.atPastEachHour !== null) {
    minuteField = `${matches.atPastEachHour}`;
    hourField = "*";
  }

  // Specific time(s)
  if (matches.parsedTimes.length === 1) {
    const { hour24, minute } = matches.parsedTimes[0]!;
    minuteField = `${minute}`;
    hourField = `${isNaN(hour24) ? "*" : hour24}`;
  }

  // Time keywords (no word boundaries for CJK languages)
  const midnightPattern = locale ? new RegExp(`(${locale.keywords.midnight.join('|')})`) : /\bmidnight\b/;
  const noonPattern = locale ? new RegExp(`(${locale.keywords.noon.join('|')})`) : /\bnoon\b/;

  if (midnightPattern.test(normalizedText)) {
    minuteField = "0";
    hourField = "0";
  }
  if (noonPattern.test(normalizedText)) {
    minuteField = "0";
    hourField = "12";
  }

  // Windows + cadence
  const everyMinutesWindowPattern = new RegExp(`\\b${everyPattern}\\s+(\\d+)\\s*${minuteKeywordPattern}\\b`);
  const everyHourWindowPattern = new RegExp(`${everyPattern}\\s+${hourKeywordPattern}|${hourlyPattern.source}`);

  if (
    matches.hourWindowRange &&
    everyMinutesWindowPattern.test(normalizedText)
  ) {
    hourField = matches.hourWindowRange;
  } else if (
    matches.hourWindowRange &&
    everyHourWindowPattern.test(normalizedText)
  ) {
    hourField = matches.hourWindowRange;
  } else if (
    matches.hourWindowRange &&
    matches.parsedTimes.length === 0
  ) {
    hourField = matches.hourWindowRange;
    minuteField = "*";
  }

  // DOM + DOW heuristic
  if (
    dayOfMonthField !== "*" &&
    /\bon\s+the\s+\d{1,2}(st|nd|rd|th)?\b/.test(normalizedText)
  ) {
    if (!matches.selectedWeekdays.length) dayOfWeekField = "*";
  }

  return {
    minute: minuteField,
    hour: hourField,
    dayOfMonth: dayOfMonthField,
    month: monthField,
    dayOfWeek: dayOfWeekField,
  };
}

/**
 * Formats cron fields into a standard cron expression string.
 *
 * Concatenates the five cron fields in standard order:
 * minute hour dayOfMonth month dayOfWeek
 *
 * @param fields - The five cron field values
 * @returns Standard cron expression string
 *
 * @example
 * ```typescript
 * formatCron({
 *   minute: "0",
 *   hour: "9",
 *   dayOfMonth: "*",
 *   month: "*",
 *   dayOfWeek: "1"
 * })
 * // => "0 9 * * 1"
 * ```
 */
export function formatCron(fields: CronFields): string {
  return `${fields.minute} ${fields.hour} ${fields.dayOfMonth} ${fields.month} ${fields.dayOfWeek}`;
}