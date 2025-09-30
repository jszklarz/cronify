![cronned](.github/assets/cronned_banner.png)

<div align="center">

### Convert natural language to cron expressions

🌍 **Multi-language support** • 🇺🇸 English • 🇪🇸 Spanish • 🇨🇳 Chinese

#### `every monday at 9am` → `0 9 * * 1`

[![npm version](https://img.shields.io/npm/v/@jszkl/cronned.svg)](https://www.npmjs.com/package/@jszkl/cronned)
[![Tests](https://github.com/jszklarz/cronned/actions/workflows/publish.yml/badge.svg)](https://github.com/jszklarz/cronned/actions/workflows/publish.yml)
[![Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://jszklarz.github.io/cronned/)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow.svg?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/jszklarz)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-pink.svg?style=for-the-badge&logo=github)](https://github.com/sponsors/jszklarz)

**[Try the live demo →](https://jszklarz.github.io/cronned/)**

</div>

## Features

✅ **Multi-language support** - English, Spanish & Chinese \
✅ Times, weekdays, dates, intervals, and time windows \
✅ Zero dependencies \
✅ Output validation \
⚠️ Detects unsupported patterns (nth weekday, business days, etc.)

## Installation

```bash
npm install @jszkl/cronned
# or
pnpm add @jszkl/cronned
# or
yarn add @jszkl/cronned
```

## Quick Start

```typescript
import { cronned } from '@jszkl/cronned';

const result = cronned("every monday at 9am");
// => { crons: ["0 9 * * 1"] }

// Check if conversion succeeded
if ("crons" in result) {
  console.log(result.crons[0]); // "0 9 * * 1"
} else {
  console.error(result.unsupported); // Error message
}

// Spanish support! 🇪🇸
cronned("cada lunes a las 9am", "es");
// => { crons: ["0 9 * * 1"] }

// Chinese support! 🇨🇳
cronned("每周一上午9点", "zh");
// => { crons: ["0 9 * * 1"] }
```

## Multi-Language Support

cronned supports multiple languages! Currently available:
- 🇺🇸 **English** (default)
- 🇪🇸 **Spanish**
- 🇨🇳 **Chinese** (Simplified)

```typescript
// English
cronned("every weekday at 9am")
// => { crons: ["0 9 * * 1-5"] }

// Spanish
cronned("cada día laborable a las 9am", "es")
// => { crons: ["0 9 * * 1-5"] }

// Chinese
cronned("工作日上午9点", "zh")
// => { crons: ["0 9 * * 1-5"] }
```

## Examples

### Basic Schedules

```typescript
cronned("every monday at 9am")
// => { crons: ["0 9 * * 1"] }

cronned("every day at midnight")
// => { crons: ["0 0 * * *"] }

cronned("daily at 9:30am")
// => { crons: ["30 9 * * *"] }

cronned("hourly")
// => { crons: ["0 * * * *"] }

cronned("every 15 minutes")
// => { crons: ["*/15 * * * *"] }
```

### Weekdays

```typescript
cronned("every weekday at 9am")
// => { crons: ["0 9 * * 1-5"] }

cronned("every weekend at noon")
// => { crons: ["0 12 * * 0,6"] }

cronned("every monday and friday at 5pm")
// => { crons: ["0 17 * * 1,5"] }
```

### Dates and Months

```typescript
cronned("on the 1st at midnight")
// => { crons: ["0 0 1 * *"] }

cronned("on the 1st and 15th at 9am")
// => { crons: ["0 9 1,15 * *"] }

cronned("every month on the 1st at midnight")
// => { crons: ["0 0 1 * *"] }

cronned("every january at midnight")
// => { crons: ["0 0 * 1 *"] }

cronned("quarterly at midnight")
// => { crons: ["0 0 * 1,4,7,10 *"] }
```

### Time Windows

```typescript
cronned("every 15 minutes between 9am and 5pm")
// => { crons: ["*/15 9-17 * * *"] }

cronned("hourly between 9am and 5pm")
// => { crons: ["0 9-17 * * *"] }
```

### Multiple Times

```typescript
cronned("at 9am and 5pm on weekdays")
// => { crons: ["0 9 * * 1-5", "0 17 * * 1-5"] }

cronned("at 8am, 12pm, and 6pm every day")
// => { crons: ["0 8 * * *", "0 12 * * *", "0 18 * * *"] }
```

### Unsupported Patterns

Some patterns are beyond standard cron capabilities:

```typescript
cronned("last friday of the month")
// => { unsupported: "Cron (standard) cannot express 'nth/last weekday of month'..." }

cronned("every business day")
// => { unsupported: "'Business days' and holiday calendars are beyond plain cron..." }

cronned("last day of the month")
// => { unsupported: "'Last day of month' is not in standard cron..." }
```

## API

### `cronned(input: string): CronResult`

Convert natural language to cron expression(s). Returns a discriminated union:

```typescript
type CronResult =
  | { crons: string[]; note?: string }
  | { unsupported: string }
```

**Parameters:**
- `input` - Natural language schedule description

**Returns:** `CronResult` - Either success with `crons` array or `unsupported` error message

**Example:**
```typescript
const result = cronned("every monday at 9am");
if ("crons" in result) {
  // Success: result.crons is string[]
  console.log(result.crons[0]);
} else {
  // Unsupported: result.unsupported is string
  console.error(result.unsupported);
}
```

## Cron Format

The generated cron expressions follow the standard 5-field format:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0)
│ │ │ │ │
* * * * *
```

## Supported Patterns

- **Times**: "at 9am", "at 5:30pm", "at noon", "at midnight"
- **Intervals**: "every 15 minutes", "every 2 hours"
- **Frequencies**: "hourly", "daily", "weekly", "monthly", "quarterly"
- **Weekdays**: "monday", "weekdays", "weekends"
- **Months**: "january", "in aug", "every jan and feb"
- **Dates**: "on the 1st", "on the 15th"
- **Time windows**: "between 9am and 5pm"
- **Combinations**: Any combination of the above

## Limitations

Standard cron cannot express:
- **Nth weekday of month**: "first monday", "last friday" → Use Quartz cron or RRULE
- **Business days**: "every business day" → Requires calendar logic
- **Last day of month**: "last day of the month" → Use Quartz `L` or generate 28-31
- **Dynamic intervals**: "every other week" → Not supported in standard cron

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## License

MIT

## Contributing

Contributions welcome! Just:
- Add tests for new features
- Keep it simple and focused

Tests run automatically on commit. Open a PR when ready!
