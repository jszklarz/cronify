// This is a CRON expression converter that takes a natural language expression and attempts to convert to the representative cron expression.
//
// Notes:
// - 0=Sunday in most crons; we'll use 1-5 for Mon-Fri and 0,6 for weekend.
// - Returns { crons: string[] } or { unsupported: string } when text exceeds cron capability.

import type { CronResult } from "./types.js";
import { normalizeInput } from "./parsers.js";
import { detectUnsupportedPatterns, matchPatterns } from "./matchers.js";
import { buildCronFields, formatCron } from "./cron-builder.js";

/**
 * Convert a natural language schedule description to cron expression(s).
 *
 * @param input - Natural language schedule description (e.g., "every monday at 9am")
 * @returns Object with either `crons` array or `unsupported` message
 *
 * @example
 * ```typescript
 * cronify("every monday at 9am")
 * // => { crons: ["0 9 * * 1"] }
 *
 * cronify("at 9am and 5pm on weekdays")
 * // => { crons: ["0 9 * * 1-5", "0 17 * * 1-5"] }
 *
 * cronify("last friday of the month")
 * // => { unsupported: "Cron (standard) cannot express 'nth/last weekday of month'..." }
 * ```
 */
export function cronify(input: string): CronResult {
  const normalizedText = normalizeInput(input);

  // Hard limitations – detect & refuse early
  const unsupportedMessage = detectUnsupportedPatterns(normalizedText);
  if (unsupportedMessage) {
    return { unsupported: unsupportedMessage };
  }

  // Match patterns
  const matches = matchPatterns(normalizedText);

  // Handle multiple distinct times (emit multiple cron lines)
  if (matches.parsedTimes.length > 1) {
    const fields = buildCronFields(normalizedText, {
      ...matches,
      parsedTimes: [], // Don't include times in base fields
    });
    const crons = matches.parsedTimes.map(
      ({ hour24, minute }) =>
        `${minute} ${isNaN(hour24) ? "*" : hour24} ${fields.dayOfMonth} ${fields.month} ${fields.dayOfWeek}`,
    );
    return { crons };
  }

  // Build cron fields
  const fields = buildCronFields(normalizedText, matches);
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