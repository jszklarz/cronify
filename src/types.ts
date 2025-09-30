export type CronResult = { crons: string[]; note?: string } | { unsupported: string };

export interface ParsedTime {
  hour24: number;
  minute: number;
}