# cronify

🕐 **Convert natural language to cron expressions**

Write "every monday at 9am" and get `0 9 * * 1`. Build scheduling UIs without making users learn cron syntax.

## Features

✅ Supports times, weekdays, dates, intervals, and time windows
✅ Zero dependencies
✅ TypeScript first
✅ Handles edge cases and validates output
⚠️ Detects unsupported patterns (nth weekday, business days, etc.)

## Installation

```bash
pnpm add cronify
# or
yarn add cronify
# or
pnpm add cronify
```

## Quick Start

```typescript
import { cronify, cronifyString } from 'cronify';

// Using the main function (returns detailed result)
cronify("every monday at 9am");
// => { crons: ["0 9 * * 1"] }

// Using the simple wrapper (returns string or null)
cronifyString("every monday at 9am");
// => "0 9 * * 1"
```

## Examples

### Basic Schedules

```typescript
cronify("every monday at 9am")
// => { crons: ["0 9 * * 1"] }

cronify("every day at midnight")
// => { crons: ["0 0 * * *"] }

cronify("daily at 9:30am")
// => { crons: ["30 9 * * *"] }

cronify("hourly")
// => { crons: ["0 * * * *"] }

cronify("every 15 minutes")
// => { crons: ["*/15 * * * *"] }
```

### Weekdays

```typescript
cronify("every weekday at 9am")
// => { crons: ["0 9 * * 1-5"] }

cronify("every weekend at noon")
// => { crons: ["0 12 * * 0,6"] }

cronify("every monday and friday at 5pm")
// => { crons: ["0 17 * * 1,5"] }
```

### Dates and Months

```typescript
cronify("on the 1st at midnight")
// => { crons: ["0 0 1 * *"] }

cronify("on the 1st and 15th at 9am")
// => { crons: ["0 9 1,15 * *"] }

cronify("every month on the 1st at midnight")
// => { crons: ["0 0 1 * *"] }

cronify("every january at midnight")
// => { crons: ["0 0 * 1 *"] }

cronify("quarterly at midnight")
// => { crons: ["0 0 * 1,4,7,10 *"] }
```

### Time Windows

```typescript
cronify("every 15 minutes between 9am and 5pm")
// => { crons: ["*/15 9-17 * * *"] }

cronify("hourly between 9am and 5pm")
// => { crons: ["0 9-17 * * *"] }
```

### Multiple Times

```typescript
cronify("at 9am and 5pm on weekdays")
// => { crons: ["0 9 * * 1-5", "0 17 * * 1-5"] }

cronify("at 8am, 12pm, and 6pm every day")
// => { crons: ["0 8 * * *", "0 12 * * *", "0 18 * * *"] }
```

### Unsupported Patterns

Some patterns are beyond standard cron capabilities:

```typescript
cronify("last friday of the month")
// => { unsupported: "Cron (standard) cannot express 'nth/last weekday of month'..." }

cronify("every business day")
// => { unsupported: "'Business days' and holiday calendars are beyond plain cron..." }

cronify("last day of the month")
// => { unsupported: "'Last day of month' is not in standard cron..." }
```

## API

### `cronify(input: string): CronResult`

Convert natural language to cron expression(s). Returns an object with either:
- `{ crons: string[] }` - Array of cron expressions
- `{ unsupported: string }` - Error message for unsupported patterns

**Parameters:**
- `input` - Natural language schedule description

**Returns:** `CronResult`

### `cronifyString(input: string): string | null`

Simplified wrapper that returns a single cron string or null. If the input generates multiple cron expressions, returns the first one.

**Parameters:**
- `input` - Natural language schedule description

**Returns:** Cron expression string or `null` if unsupported

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

Contributions welcome! Please open an issue or PR.