import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addDays,
    daysBetween,
    isFutureDate,
    isMonday,
    isSunday,
    isValidDateString,
    todayInTimezone,
} from './iso-week';

describe('isValidDateString', () => {
    it('accepts well-formed dates', () => {
        expect(isValidDateString('2026-05-11')).toBe(true);
        expect(isValidDateString('2024-02-29')).toBe(true); // leap day
    });

    it('rejects malformed strings', () => {
        expect(isValidDateString('2026-5-11')).toBe(false);
        expect(isValidDateString('2026/05/11')).toBe(false);
        expect(isValidDateString('not-a-date')).toBe(false);
        expect(isValidDateString('')).toBe(false);
    });

    it('rejects invalid calendar dates that match the pattern', () => {
        expect(isValidDateString('2026-02-30')).toBe(false);
        expect(isValidDateString('2026-13-01')).toBe(false);
        expect(isValidDateString('2023-02-29')).toBe(false); // not a leap year
    });
});

describe('isMonday / isSunday', () => {
    it('detects Monday correctly', () => {
        expect(isMonday('2026-05-11')).toBe(true); // Monday
        expect(isMonday('2026-05-12')).toBe(false); // Tuesday
        expect(isMonday('2026-05-17')).toBe(false); // Sunday
    });

    it('detects Sunday correctly', () => {
        expect(isMonday('2026-05-17')).toBe(false);
        expect(isSunday('2026-05-17')).toBe(true);
        expect(isSunday('2026-05-11')).toBe(false);
    });

    it('returns false for invalid date strings', () => {
        expect(isMonday('not-a-date')).toBe(false);
        expect(isSunday('2026-13-01')).toBe(false);
    });
});

describe('addDays', () => {
    it('adds 6 days for Mon→Sun', () => {
        expect(addDays('2026-05-11', 6)).toBe('2026-05-17');
    });

    it('handles month rollover', () => {
        expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    });

    it('handles year rollover', () => {
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    });

    it('handles negative offsets', () => {
        expect(addDays('2026-05-11', -7)).toBe('2026-05-04');
    });

    it('handles leap-day arithmetic', () => {
        expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
        expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    });

    it('throws on invalid input', () => {
        expect(() => addDays('not-a-date', 1)).toThrow();
    });
});

describe('daysBetween', () => {
    it('counts forward span inclusively-exclusively', () => {
        expect(daysBetween('2026-05-11', '2026-05-17')).toBe(6);
    });

    it('returns 0 when both endpoints are equal', () => {
        expect(daysBetween('2026-05-11', '2026-05-11')).toBe(0);
    });

    it('returns negative for reversed span', () => {
        expect(daysBetween('2026-05-17', '2026-05-11')).toBe(-6);
    });
});

describe('todayInTimezone', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns the calendar date in the given timezone', () => {
        // 2026-05-14 23:30 UTC is already 2026-05-15 in Warsaw (UTC+2)
        vi.setSystemTime(new Date('2026-05-14T23:30:00Z'));
        expect(todayInTimezone('UTC')).toBe('2026-05-14');
        expect(todayInTimezone('Europe/Warsaw')).toBe('2026-05-15');
    });

    it('returns the same date when timezone is UTC and the time is mid-day', () => {
        vi.setSystemTime(new Date('2026-05-14T12:00:00Z'));
        expect(todayInTimezone('UTC')).toBe('2026-05-14');
    });
});

describe('isFutureDate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-14T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns false for today', () => {
        expect(isFutureDate('2026-05-14', 'UTC')).toBe(false);
    });

    it('returns true for tomorrow', () => {
        expect(isFutureDate('2026-05-15', 'UTC')).toBe(true);
    });

    it('returns false for yesterday', () => {
        expect(isFutureDate('2026-05-13', 'UTC')).toBe(false);
    });

    it('respects timezone — date can be "today" UTC but past in eastern timezone', () => {
        // 2026-05-14 12:00 UTC is already past midnight 2026-05-14 in Warsaw too
        expect(isFutureDate('2026-05-14', 'Europe/Warsaw')).toBe(false);
    });

    it('returns false on invalid input rather than throwing', () => {
        expect(isFutureDate('not-a-date')).toBe(false);
    });
});
