import { describe, it, expect } from 'vitest';
import { cronify } from './index';

/**
 * ReDoS (Regular Expression Denial of Service) protection tests.
 *
 * These tests ensure that malicious or pathological inputs cannot cause
 * catastrophic backtracking in our regex patterns, which could lead to
 * CPU exhaustion and denial of service.
 *
 * Each test has a reasonable timeout to detect exponential-time behavior.
 */
describe('ReDoS protection', () => {
  const TIMEOUT_MS = 100; // Should complete well under 100ms

  describe('repeated words and patterns', () => {
    it(
      'handles extremely long repeated weekday names',
      () => {
        // Repeat "monday " 1000 times
        const input = 'monday '.repeat(1000);
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles extremely long repeated "every" keywords',
      () => {
        const input = 'every '.repeat(1000) + 'day';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles repeated "at" keywords',
      () => {
        const input = 'at '.repeat(1000) + '9am';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('pathological whitespace patterns', () => {
    it(
      'handles excessive spaces',
      () => {
        const input = 'every' + ' '.repeat(10000) + 'monday';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles alternating text and spaces',
      () => {
        let input = '';
        for (let i = 0; i < 500; i++) {
          input += 'a ';
        }
        input += 'monday';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('pathological comma patterns', () => {
    it(
      'handles excessive commas',
      () => {
        const input = ','.repeat(10000) + 'every monday';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles alternating commas and spaces',
      () => {
        const input = ', '.repeat(5000) + 'every monday';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('pathological time patterns', () => {
    it(
      'handles repeated time-like patterns',
      () => {
        const input = '99:99 '.repeat(1000);
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles repeated "between" keywords',
      () => {
        const input = 'between '.repeat(1000) + '9am and 5pm';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles alternating numbers and colons',
      () => {
        const input = '1:2:3:4:5:'.repeat(1000);
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('pathological day-of-month patterns', () => {
    it(
      'handles repeated "on the" patterns',
      () => {
        const input = 'on the '.repeat(1000) + '1st';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles repeated ordinal suffixes',
      () => {
        const input = 'on the 1stndrdth'.repeat(500);
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('pathological month patterns', () => {
    it(
      'handles repeated month names',
      () => {
        const input = 'january february march april may june july august september october november december '.repeat(
          100,
        );
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('extremely long inputs', () => {
    it(
      'handles 100KB of random text',
      () => {
        const input = 'x'.repeat(100000);
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles 100KB of valid keywords',
      () => {
        const input = 'every monday at 9am '.repeat(5000);
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('nested quantifiers simulation', () => {
    it(
      'handles patterns that might cause backtracking',
      () => {
        // Patterns like "aaaaaaaaaaaab" that don't match expected patterns
        const input = 'a'.repeat(10000) + 'b';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles almost-matching patterns',
      () => {
        // "mondaymondaymonday" without spaces - shouldn't match but shouldn't hang
        const input = 'monday'.repeat(1000);
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('unicode and special characters', () => {
    it(
      'handles unicode characters',
      () => {
        const input = '\u{1F4A9}'.repeat(1000) + ' every monday';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles mixed unicode and ascii',
      () => {
        const input = 'every \u{1F4A9} monday \u{1F4A9} at \u{1F4A9} 9am';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('boundary testing', () => {
    it(
      'handles maximum valid day numbers repeated',
      () => {
        const input = 'on the 31st '.repeat(1000);
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles maximum valid hour values repeated',
      () => {
        const input = 'at 23:59 '.repeat(1000);
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });

  describe('combined attack vectors', () => {
    it(
      'handles multiple pathological patterns combined',
      () => {
        const input =
          ' '.repeat(1000) +
          ','.repeat(1000) +
          'every'.repeat(100) +
          ' monday'.repeat(100) +
          ' at 9am';
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );

    it(
      'handles alternating valid and invalid patterns',
      () => {
        let input = '';
        for (let i = 0; i < 100; i++) {
          input += 'every monday xxxxxxxx ';
        }
        const result = cronify(input);
        expect(result).toBeDefined();
      },
      TIMEOUT_MS,
    );
  });
});