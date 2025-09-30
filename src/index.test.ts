import { describe, it, expect } from 'vitest';
import { cronned } from './index';

describe('cronned', () => {
  describe('basic schedules', () => {
    it('converts "every monday at 9am"', () => {
      const result = cronned('every monday at 9am');
      expect(result).toEqual({ crons: ['0 9 * * 1'] });
    });

    it('converts "every day at midnight"', () => {
      const result = cronned('every day at midnight');
      expect(result).toEqual({ crons: ['0 0 * * *'] });
    });

    it('converts "daily at 9:30am"', () => {
      const result = cronned('daily at 9:30am');
      expect(result).toEqual({ crons: ['30 9 * * *'] });
    });

    it('converts "hourly"', () => {
      const result = cronned('hourly');
      expect(result).toEqual({ crons: ['0 * * * *'] });
    });

    it('converts "every 15 minutes"', () => {
      const result = cronned('every 15 minutes');
      expect(result).toEqual({ crons: ['*/15 * * * *'] });
    });

    it('converts "every 2 hours"', () => {
      const result = cronned('every 2 hours');
      expect(result).toEqual({ crons: ['0 */2 * * *'] });
    });
  });

  describe('weekdays', () => {
    it('converts "every weekday at 9am"', () => {
      const result = cronned('every weekday at 9am');
      expect(result).toEqual({ crons: ['0 9 * * 1-5'] });
    });

    it('converts "every weekend at noon"', () => {
      const result = cronned('every weekend at noon');
      expect(result).toEqual({ crons: ['0 12 * * 0,6'] });
    });

    it('converts "every monday and friday at 5pm"', () => {
      const result = cronned('every monday and friday at 5pm');
      expect(result).toEqual({ crons: ['0 17 * * 1,5'] });
    });

    it('converts "every tuesday at 9am"', () => {
      const result = cronned('every tuesday at 9am');
      expect(result).toEqual({ crons: ['0 9 * * 2'] });
    });
  });

  describe('dates and months', () => {
    it('converts "on the 1st at midnight"', () => {
      const result = cronned('on the 1st at midnight');
      expect(result).toEqual({ crons: ['0 0 1 * *'] });
    });

    it('converts "on the 1st at 9am"', () => {
      const result = cronned('on the 1st at 9am');
      expect(result).toEqual({ crons: ['0 9 1 * *'] });
    });

    it('converts "every january at midnight"', () => {
      const result = cronned('every january at midnight');
      expect(result).toEqual({ crons: ['0 0 * 1 *'] });
    });

    it('converts "quarterly at midnight"', () => {
      const result = cronned('quarterly at midnight');
      expect(result).toEqual({ crons: ['0 0 * 1,4,7,10 *'] });
    });
  });

  describe('time windows', () => {
    it('converts "every 15 minutes between 9am and 5pm"', () => {
      const result = cronned('every 15 minutes between 9am and 5pm');
      expect(result).toEqual({ crons: ['*/15 9-17 * * *'] });
    });

    it('converts "hourly between 9am and 5pm"', () => {
      const result = cronned('hourly between 9am and 5pm');
      expect(result).toEqual({ crons: ['0 9-17 * * *'] });
    });
  });

  describe('multiple times', () => {
    it('converts "at 9am on weekdays"', () => {
      const result = cronned('at 9am on weekdays');
      expect(result).toEqual({ crons: ['0 9 * * 1-5'] });
    });

    it('converts "at 8am every day"', () => {
      const result = cronned('at 8am every day');
      expect(result).toEqual({ crons: ['0 8 * * *'] });
    });
  });

  describe('special times', () => {
    it('converts "at noon"', () => {
      const result = cronned('at noon');
      expect(result).toEqual({ crons: ['0 12 * * *'] });
    });

    it('converts "at midnight"', () => {
      const result = cronned('at midnight');
      expect(result).toEqual({ crons: ['0 0 * * *'] });
    });
  });

  describe('unsupported patterns', () => {
    it('detects "last friday of the month"', () => {
      const result = cronned('last friday of the month');
      expect(result).toHaveProperty('unsupported');
      expect(result).toMatchObject({
        unsupported: expect.stringContaining('nth/last weekday'),
      });
    });

    it('detects "every business day"', () => {
      const result = cronned('every business day');
      expect(result).toHaveProperty('unsupported');
      expect(result).toMatchObject({
        unsupported: expect.stringContaining('Business days'),
      });
    });

    it('detects "last day of the month"', () => {
      const result = cronned('last day of the month');
      expect(result).toHaveProperty('unsupported');
      expect(result).toMatchObject({
        unsupported: expect.stringContaining('Last day of month'),
      });
    });
  });

  describe('edge cases', () => {
    it('handles 24-hour format', () => {
      const result = cronned('every day at 17:30');
      expect(result).toEqual({ crons: ['30 17 * * *'] });
    });

    it('handles AM/PM correctly', () => {
      const result = cronned('at 12pm');
      expect(result).toEqual({ crons: ['0 12 * * *'] });
    });

    it('handles 12am as midnight', () => {
      const result = cronned('at 12am');
      expect(result).toEqual({ crons: ['0 0 * * *'] });
    });

    it('handles mixed case and extra spaces', () => {
      const result = cronned('  Every  MONDAY   at  9AM  ');
      expect(result).toEqual({ crons: ['0 9 * * 1'] });
    });
  });
});

