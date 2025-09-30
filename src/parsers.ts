import type { ParsedTime } from "./types.js";

/**
 * Converts a 12-hour time format to 24-hour format.
 *
 * @param hour12 - The hour in 12-hour format (1-12)
 * @param ampm - Optional AM/PM indicator
 * @returns Hour in 24-hour format (0-23)
 *
 * @example
 * ```typescript
 * to24Hour(12, "am") // => 0 (midnight)
 * to24Hour(12, "pm") // => 12 (noon)
 * to24Hour(5, "pm")  // => 17
 * to24Hour(9)        // => 9 (no conversion)
 * ```
 */
export function to24Hour(hour12: number, ampm?: "am" | "pm"): number {
  if (!ampm) return hour12;
  if (ampm === "am") return hour12 % 12; // 12am -> 0
  return (hour12 % 12) + 12; // 12pm -> 12
}

/**
 * Parses a time string into hour and minute components.
 *
 * Supports multiple formats:
 * - "5pm", "5:30pm" - 12-hour format with AM/PM
 * - "17:00" - 24-hour format
 * - ":05" - Minute-only format (returns NaN for hour)
 *
 * @param timeString - The time string to parse
 * @returns Parsed time object or null if invalid
 *
 * @example
 * ```typescript
 * parseTime("5pm")      // => { hour24: 17, minute: 0 }
 * parseTime("9:30 am")  // => { hour24: 9, minute: 30 }
 * parseTime(":05")      // => { hour24: NaN, minute: 5 }
 * parseTime("invalid")  // => null
 * ```
 */
export function parseTime(timeString: string): ParsedTime | null {
  const s = timeString.trim();

  // Chinese time format: "上午9点", "下午5点30分", "晚上8点", "9点", "零点", "中午", "午夜"
  // Handle special keywords first
  if (s.includes('零点') || s.includes('午夜') || s.includes('凌晨')) {
    return { hour24: 0, minute: 0 };
  }
  if (s.includes('中午') || s.includes('正午')) {
    return { hour24: 12, minute: 0 };
  }

  // Match time with period markers, including 点半 (half past)
  const chineseTimeMatch = s.match(/(上午|下午|晚上|傍晚|夜间|早上)?(\d{1,2})点(半|(\d{1,2})分?)?/);
  if (chineseTimeMatch) {
    const period = chineseTimeMatch[1];
    let hour = parseInt(chineseTimeMatch[2], 10);
    const isBan = chineseTimeMatch[3] === '半'; // 点半 = :30
    const minute = isBan ? 30 : (chineseTimeMatch[4] ? parseInt(chineseTimeMatch[4], 10) : 0);

    // Handle period markers
    if ((period === '下午' || period === '晚上' || period === '傍晚' || period === '夜间') && hour < 12) {
      hour += 12;
    } else if ((period === '上午' || period === '早上') && hour === 12) {
      hour = 0;
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour24: hour, minute };
    }
  }

  const explicitTimeMatch = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (explicitTimeMatch) {
    const parsedHour = to24Hour(
      parseInt(explicitTimeMatch[1], 10),
      explicitTimeMatch[3] as "am" | "pm" | undefined,
    );
    const parsedMinute = explicitTimeMatch[2]
      ? parseInt(explicitTimeMatch[2], 10)
      : 0;
    if (
      parsedHour >= 0 &&
      parsedHour <= 23 &&
      parsedMinute >= 0 &&
      parsedMinute <= 59
    ) {
      return { hour24: parsedHour, minute: parsedMinute };
    }
  }

  // ":05" alone
  const minuteOnlyMatch = s.match(/:(\d{2})\b/);
  if (minuteOnlyMatch) {
    const parsedMinute = parseInt(minuteOnlyMatch[1], 10);
    if (parsedMinute >= 0 && parsedMinute <= 59)
      return { hour24: NaN, minute: parsedMinute };
  }
  return null;
}

/**
 * Normalizes user input by lowercasing, collapsing whitespace, and removing commas.
 *
 * This prepares the input string for consistent pattern matching by:
 * - Converting to lowercase
 * - Replacing commas with spaces
 * - Collapsing multiple spaces into single spaces
 * - Trimming leading/trailing whitespace
 *
 * @param input - Raw user input string
 * @returns Normalized string ready for pattern matching
 *
 * @example
 * ```typescript
 * normalizeInput("Every  Monday, Wednesday")
 * // => "every monday wednesday"
 * ```
 */
export function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}