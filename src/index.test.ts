import { describe, it, expect } from 'vitest';
import { cronned } from './index';

describe('cronned', () => {
  describe('basic schedules', () => {
    it.each([
      { en: 'every monday at 9am', es: 'cada lunes a las 9am', expected: ['0 9 * * 1'] },
      { en: 'every day at midnight', es: 'cada día a medianoche', expected: ['0 0 * * *'] },
      { en: 'daily at 9:30am', es: 'diariamente a las 9:30am', expected: ['30 9 * * *'] },
      { en: 'hourly', es: 'cada hora', expected: ['0 * * * *'] },
      { en: 'every 15 minutes', es: 'cada 15 minutos', expected: ['*/15 * * * *'] },
      { en: 'every 2 hours', es: 'cada 2 horas', expected: ['0 */2 * * *'] },
    ])('converts "$en" and "$es"', ({ en, es, expected }) => {
      expect(cronned(en)).toEqual({ crons: expected });
      expect(cronned(es, 'es')).toEqual({ crons: expected });
    });
  });

  describe('weekdays', () => {
    it.each([
      { en: 'every weekday at 9am', es: 'cada día laborable a las 9am', expected: ['0 9 * * 1-5'] },
      { en: 'every weekend at noon', es: 'cada fin de semana a mediodía', expected: ['0 12 * * 0,6'] },
      { en: 'every monday and friday at 5pm', es: 'cada lunes y viernes a las 5pm', expected: ['0 17 * * 1,5'] },
    ])('converts "$en" and "$es"', ({ en, es, expected }) => {
      expect(cronned(en)).toEqual({ crons: expected });
      expect(cronned(es, 'es')).toEqual({ crons: expected });
    });

    it('converts "every tuesday at 9am"', () => {
      const result = cronned('every tuesday at 9am');
      expect(result).toEqual({ crons: ['0 9 * * 2'] });
    });

    it('handles "mon" in "month" without collision', () => {
      const result = cronned('every month at midnight');
      expect(result).toEqual({ crons: ['0 0 1 * *'] });
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

  describe('Chinese locale', () => {
    it.each([
      { zh: '每周一上午9点', en: 'Every Monday at 9am', expected: ['0 9 * * 1'] },
      { zh: '每天零点', en: 'Every day at midnight', expected: ['0 0 * * *'] },
      { zh: '每15分钟', en: 'Every 15 minutes', expected: ['*/15 * * * *'] },
      { zh: '工作日下午5点', en: 'Weekdays at 5pm', expected: ['0 17 * * 1-5'] },
      { zh: '周末中午', en: 'Weekend at noon', expected: ['0 12 * * 0,6'] },
      { zh: '每周五', en: 'Every Friday', expected: ['* * * * 5'] },
    ])('converts "$zh" ($en)', ({ zh, expected }) => {
      expect(cronned(zh, 'zh')).toEqual({ crons: expected });
    });

    it('detects "最后星期五" (last friday)', () => {
      const result = cronned('最后星期五', 'zh');
      expect(result).toHaveProperty('unsupported');
      expect(result).toMatchObject({
        unsupported: expect.stringContaining('nth/last weekday'),
      });
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

    it('rejects gibberish input', () => {
      const result = cronned('salfnaksjndaksnkda s daj skdj ak');
      expect(result).toHaveProperty('unsupported');
      expect(result).toMatchObject({
        unsupported: expect.stringContaining('Could not understand'),
      });
    });

    it('rejects empty input', () => {
      const result = cronned('');
      expect(result).toHaveProperty('unsupported');
    });

    it('rejects whitespace-only input', () => {
      const result = cronned('   ');
      expect(result).toHaveProperty('unsupported');
    });
  });
});

