// This is a CRON expression converter that takes a natural language expression and attempts to convert to the representative cron expression.
//
// Notes:
// - 0=Sunday in most crons; we'll use 1-5 for Mon-Fri and 0,6 for weekend.
// - Returns { crons: string[] } or { unsupported: string } when text exceeds cron capability.

import type { CronResult } from "./types.js";
import { normalizeInput } from "./parsers.js";
import { detectUnsupportedPatterns, matchPatterns } from "./matchers.js";
import { buildCronFields, formatCron } from "./cron-builder.js";
import { getLocale } from "./locales/index.js";

/**
 * Convert a natural language schedule description to cron expression(s).
 *
 * @param input - Natural language schedule description (e.g., "every monday at 9am")
 * @param locale - Optional locale code (e.g., "en", "es"). Defaults to "en"
 * @returns Object with either `crons` array or `unsupported` message
 *
 * @example
 * ```typescript
 * cronned("every monday at 9am")
 * // => { crons: ["0 9 * * 1"] }
 *
 * cronned("cada lunes a las 9am", "es")
 * // => { crons: ["0 9 * * 1"] }
 *
 * cronned("at 9am and 5pm on weekdays")
 * // => { crons: ["0 9 * * 1-5", "0 17 * * 1-5"] }
 *
 * cronned("last friday of the month")
 * // => { unsupported: "Cron (standard) cannot express 'nth/last weekday of month'..." }
 * ```
 */
export function cronned(input: string, locale: string = "en"): CronResult {
  const localeConstants = getLocale(locale);
  const normalizedText = normalizeInput(input);

  // Hard limitations – detect & refuse early
  const unsupportedMessage = detectUnsupportedPatterns(normalizedText, localeConstants);
  if (unsupportedMessage) {
    return { unsupported: unsupportedMessage };
  }

  // Match patterns
  const matches = matchPatterns(normalizedText, localeConstants);

  // Check if any meaningful patterns were matched
  const keywords = localeConstants.keywords;
  const keywordPattern = new RegExp(
    `\\b(${[
      ...keywords.every,
      ...keywords.hourly,
      ...keywords.daily,
      ...keywords.weekly,
      ...keywords.monthly,
      ...keywords.weekday,
      ...keywords.weekend,
      ...keywords.midnight,
      ...keywords.noon,
      ...keywords.minute,
      ...keywords.hour,
      ...keywords.day,
      ...keywords.week,
      ...keywords.month,
    ].join('|')})\\b`
  );
  const hasAnyMatch =
    matches.selectedMonths.length > 0 ||
    matches.selectedWeekdays.length > 0 ||
    matches.selectedMonthDays.length > 0 ||
    matches.parsedTimes.length > 0 ||
    matches.hourWindowRange !== null ||
    matches.everyNMinutes !== null ||
    matches.everyNHours !== null ||
    matches.atPastEachHour !== null ||
    keywordPattern.test(normalizedText);

  if (!hasAnyMatch) {
    return {
      unsupported: "Could not understand the input. Please use natural language like 'every monday at 9am'.",
    };
  }

  // Handle multiple distinct times (emit multiple cron lines)
  if (matches.parsedTimes.length > 1) {
    const fields = buildCronFields(normalizedText, {
      ...matches,
      parsedTimes: [], // Don't include times in base fields
    }, localeConstants);
    const crons = matches.parsedTimes.map(
      ({ hour24, minute }) =>
        `${minute} ${isNaN(hour24) ? "*" : hour24} ${fields.dayOfMonth} ${fields.month} ${fields.dayOfWeek}`,
    );
    return { crons };
  }

  // Build cron fields
  const fields = buildCronFields(normalizedText, matches, localeConstants);
  const compiledCron = formatCron(fields);

  // Validate lightly
  if (
    !/^[*\d/,\-/]+ [*\d/,\-/]+ [*\d/,\-/]+ [*\d/,\-/]+ [*\d/,\-/]+$/.test(
      compiledCron,
    )
  ) {
    return {
      unsupported: "Could not construct a valid cron from the given text.",
    };
  }
  return { crons: [compiledCron] };
}

// Export types
export type { CronResult } from "./types.js";