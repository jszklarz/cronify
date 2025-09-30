// src/parsers.ts
function to24Hour(hour12, ampm) {
  if (!ampm) return hour12;
  if (ampm === "am") return hour12 % 12;
  return hour12 % 12 + 12;
}
function parseTime(timeString) {
  const s = timeString.trim();
  const explicitTimeMatch = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (explicitTimeMatch) {
    const parsedHour = to24Hour(
      parseInt(explicitTimeMatch[1], 10),
      explicitTimeMatch[3]
    );
    const parsedMinute = explicitTimeMatch[2] ? parseInt(explicitTimeMatch[2], 10) : 0;
    if (parsedHour >= 0 && parsedHour <= 23 && parsedMinute >= 0 && parsedMinute <= 59) {
      return { hour24: parsedHour, minute: parsedMinute };
    }
  }
  const minuteOnlyMatch = s.match(/:(\d{2})\b/);
  if (minuteOnlyMatch) {
    const parsedMinute = parseInt(minuteOnlyMatch[1], 10);
    if (parsedMinute >= 0 && parsedMinute <= 59)
      return { hour24: NaN, minute: parsedMinute };
  }
  return null;
}
function normalizeInput(input) {
  return input.toLowerCase().replace(/[,]+/g, " ").replace(/\s+/g, " ").trim();
}

// src/constants.ts
var WEEKDAYS = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6
};
var MONTHS = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12
};

// src/matchers.ts
function detectUnsupportedPatterns(text) {
  if (/\b(last|nth|first|second|third|fourth)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
    text
  )) {
    return "Cron (standard) cannot express 'nth/last weekday of month'. Use RRULE or Quartz.";
  }
  if (/\bbusiness\s*days?\b/.test(text)) {
    return "'Business days' and holiday calendars are beyond plain cron. Use RRULE + calendar exceptions.";
  }
  if (/\b(last\s+day\s+of\s+the\s+month|eom|end\s+of\s+month)\b/.test(text)) {
    return "'Last day of month' is not in standard cron. Use Quartz L or emit 28-31 with guard logic.";
  }
  return null;
}
function matchPatterns(normalizedText) {
  const selectedMonths = [];
  const selectedWeekdays = [];
  const selectedMonthDays = [];
  for (const monthKey of Object.keys(MONTHS)) {
    if (normalizedText.includes(` ${monthKey} `) || normalizedText.endsWith(` ${monthKey}`) || normalizedText.startsWith(`${monthKey} `)) {
      selectedMonths.push(MONTHS[monthKey]);
    }
  }
  if (/\bquarter(ly)?\b/.test(normalizedText)) {
    selectedMonths.push(1, 4, 7, 10);
  }
  const weekdayRegex = /\b(sun|mon|tue|tues|wed|thu|thurs|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g;
  const weekdayMatches = [...normalizedText.matchAll(weekdayRegex)];
  if (weekdayMatches.length) {
    weekdayMatches.forEach(
      (match) => selectedWeekdays.push(WEEKDAYS[match[1]])
    );
  }
  const dayOfMonthMatches = [
    ...normalizedText.matchAll(/\bon\s+the\s+(\d{1,2})(st|nd|rd|th)?\b/g)
  ];
  if (dayOfMonthMatches.length) {
    dayOfMonthMatches.forEach(
      (match) => selectedMonthDays.push(parseInt(match[1], 10))
    );
  }
  const everyNMinutesMatch = normalizedText.match(
    /\bevery\s+(\d+)\s*minutes?\b/
  );
  const everyNMinutes = everyNMinutesMatch ? Math.max(1, Math.min(59, parseInt(everyNMinutesMatch[1], 10))) : null;
  const everyNHoursMatch = normalizedText.match(/\bevery\s+(\d+)\s*hours?\b/);
  const everyNHours = everyNHoursMatch ? Math.max(1, Math.min(23, parseInt(everyNHoursMatch[1], 10))) : null;
  const atPastEachHourMatch = normalizedText.match(
    /\bat\s*:(\d{2})\s*(past\s+)?(each|every)\s+hour\b/
  );
  const atPastEachHour = atPastEachHourMatch ? parseInt(atPastEachHourMatch[1], 10) : null;
  const betweenWindowMatch = normalizedText.match(
    /\bbetween\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+and\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/
  );
  let hourWindowRange = null;
  if (betweenWindowMatch) {
    const startHour = to24Hour(
      parseInt(betweenWindowMatch[1], 10),
      betweenWindowMatch[3]
    );
    const endHour = to24Hour(
      parseInt(betweenWindowMatch[4], 10),
      betweenWindowMatch[6]
    );
    const windowStart = Math.min(startHour, endHour);
    const windowEnd = Math.max(startHour, endHour);
    hourWindowRange = `${windowStart}-${windowEnd}`;
  }
  const explicitTimePhrases = [
    ...normalizedText.matchAll(/\bat\s+((\d{1,2})(?::(\d{2}))?\s*(am|pm)?)\b/g)
  ];
  const parsedTimes = explicitTimePhrases.map((match) => parseTime(match[1])).filter(Boolean);
  return {
    selectedMonths,
    selectedWeekdays,
    selectedMonthDays,
    parsedTimes,
    hourWindowRange,
    everyNMinutes,
    everyNHours,
    atPastEachHour
  };
}

// src/cron-builder.ts
function listToCron(numberList, maxValue, allowStar = true) {
  if (!numberList || numberList.length === 0) return allowStar ? "*" : "0";
  const uniqueSorted = [...new Set(numberList)].sort((a, b) => a - b);
  if (uniqueSorted.length === maxValue) return "*";
  return uniqueSorted.join(",");
}
function buildCronFields(normalizedText, matches) {
  let minuteField = "*";
  let hourField = "*";
  let dayOfMonthField = "*";
  let monthField = "*";
  let dayOfWeekField = "*";
  if (matches.selectedMonths.length) {
    monthField = listToCron(matches.selectedMonths, 12);
  }
  if (/\bweekdays?\b/.test(normalizedText)) dayOfWeekField = "1-5";
  if (/\bweekends?\b/.test(normalizedText)) dayOfWeekField = "0,6";
  if (matches.selectedWeekdays.length) {
    dayOfWeekField = listToCron(matches.selectedWeekdays, 7);
  }
  if (matches.selectedMonthDays.length) {
    dayOfMonthField = listToCron(matches.selectedMonthDays, 31);
  }
  if (matches.everyNMinutes !== null) {
    minuteField = `*/${matches.everyNMinutes}`;
  }
  if (matches.everyNHours !== null) {
    hourField = `*/${matches.everyNHours}`;
    if (minuteField === "*") minuteField = "0";
  }
  if (/\bevery\s+minute\b/.test(normalizedText)) {
    minuteField = "*";
    hourField = "*";
  }
  if (/\bevery\s+hour\b/.test(normalizedText)) {
    minuteField = "0";
    hourField = "*";
  }
  if (/\bevery\s+day\b/.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
  }
  if (/\bevery\s+week\b/.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
    dayOfWeekField = "0";
  }
  if (/\bevery\s+month\b/.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
    dayOfMonthField = "1";
  }
  if (/\bhourly\b/.test(normalizedText) && minuteField === "*") {
    minuteField = "0";
    hourField = "*";
  }
  if (/\bdaily\b/.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
  }
  if (/\bweekly\b/.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
    dayOfWeekField = "0";
  }
  if (/\bmonthly\b/.test(normalizedText)) {
    if (hourField === "*" && minuteField === "*") {
      minuteField = "0";
      hourField = "0";
    }
    dayOfMonthField = "1";
  }
  if (matches.atPastEachHour !== null) {
    minuteField = `${matches.atPastEachHour}`;
    hourField = "*";
  }
  if (matches.parsedTimes.length === 1) {
    const { hour24, minute } = matches.parsedTimes[0];
    minuteField = `${minute}`;
    hourField = `${isNaN(hour24) ? "*" : hour24}`;
  }
  if (/\bmidnight\b/.test(normalizedText)) {
    minuteField = "0";
    hourField = "0";
  }
  if (/\bnoon\b/.test(normalizedText)) {
    minuteField = "0";
    hourField = "12";
  }
  if (matches.hourWindowRange && /\bevery\s+(\d+)\s*minutes?\b/.test(normalizedText)) {
    hourField = matches.hourWindowRange;
  } else if (matches.hourWindowRange && /every\s+hour|hourly/.test(normalizedText)) {
    hourField = matches.hourWindowRange;
  } else if (matches.hourWindowRange && matches.parsedTimes.length === 0) {
    hourField = matches.hourWindowRange;
    minuteField = "*";
  }
  if (dayOfMonthField !== "*" && /\bon\s+the\s+\d{1,2}(st|nd|rd|th)?\b/.test(normalizedText)) {
    if (!matches.selectedWeekdays.length) dayOfWeekField = "*";
  }
  return {
    minute: minuteField,
    hour: hourField,
    dayOfMonth: dayOfMonthField,
    month: monthField,
    dayOfWeek: dayOfWeekField
  };
}
function formatCron(fields) {
  return `${fields.minute} ${fields.hour} ${fields.dayOfMonth} ${fields.month} ${fields.dayOfWeek}`;
}

// src/index.ts
function cronify(input) {
  const normalizedText = normalizeInput(input);
  const unsupportedMessage = detectUnsupportedPatterns(normalizedText);
  if (unsupportedMessage) {
    return { unsupported: unsupportedMessage };
  }
  const matches = matchPatterns(normalizedText);
  if (matches.parsedTimes.length > 1) {
    const fields2 = buildCronFields(normalizedText, {
      ...matches,
      parsedTimes: []
      // Don't include times in base fields
    });
    const crons = matches.parsedTimes.map(
      ({ hour24, minute }) => `${minute} ${isNaN(hour24) ? "*" : hour24} ${fields2.dayOfMonth} ${fields2.month} ${fields2.dayOfWeek}`
    );
    return { crons };
  }
  const fields = buildCronFields(normalizedText, matches);
  const compiledCron = formatCron(fields);
  if (!/^[*\d/,\-/]+ [*\d/,\-/]+ [*\d/,\-/]+ [*\d/,\-/]+ [*\d/,\-/]+$/.test(
    compiledCron
  )) {
    return {
      unsupported: "Could not construct a valid cron from the given text."
    };
  }
  return { crons: [compiledCron] };
}
function cronifyString(input) {
  try {
    const result = cronify(input);
    if ("unsupported" in result) return null;
    return result.crons[0] ?? null;
  } catch {
    return null;
  }
}
export {
  cronify,
  cronifyString
};
