import { describe, it, expect } from 'vitest';
import { metersToKm, kmToMeters, secondsToHms, hmsToSeconds, formatGoalTime } from './running-goal-format';

describe('metersToKm', () => {
    it('converts meters to kilometers', () => {
        expect(metersToKm(42195)).toBeCloseTo(42.195);
        expect(metersToKm(5000)).toBe(5);
    });

    it('passes through null/undefined', () => {
        expect(metersToKm(null)).toBeNull();
        expect(metersToKm(undefined)).toBeNull();
    });
});

describe('kmToMeters', () => {
    it('converts kilometers to whole meters', () => {
        expect(kmToMeters(42.195)).toBe(42195);
        expect(kmToMeters(5)).toBe(5000);
        expect(kmToMeters(10.1)).toBe(10100);
    });

    it('returns null for null/undefined/NaN', () => {
        expect(kmToMeters(null)).toBeNull();
        expect(kmToMeters(undefined)).toBeNull();
        expect(kmToMeters(NaN)).toBeNull();
    });
});

describe('secondsToHms', () => {
    it('splits seconds into parts', () => {
        expect(secondsToHms(3661)).toEqual({ hours: 1, minutes: 1, seconds: 1 });
        expect(secondsToHms(125)).toEqual({ hours: 0, minutes: 2, seconds: 5 });
    });

    it('returns zeros for null/zero/negative', () => {
        expect(secondsToHms(null)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
        expect(secondsToHms(0)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
        expect(secondsToHms(-5)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    });
});

describe('hmsToSeconds', () => {
    it('combines parts into total seconds', () => {
        expect(hmsToSeconds(1, 1, 1)).toBe(3661);
        expect(hmsToSeconds(0, 2, 5)).toBe(125);
    });

    it('treats null parts as zero', () => {
        expect(hmsToSeconds(null, 30, null)).toBe(1800);
    });

    it('returns null when total is zero', () => {
        expect(hmsToSeconds(0, 0, 0)).toBeNull();
        expect(hmsToSeconds(null, null, null)).toBeNull();
    });
});

describe('formatGoalTime', () => {
    it('formats with hours', () => {
        expect(formatGoalTime(3661)).toBe('1:01:01');
        expect(formatGoalTime(14400)).toBe('4:00:00');
    });

    it('formats without hours', () => {
        expect(formatGoalTime(125)).toBe('2:05');
    });

    it('returns null for empty/zero', () => {
        expect(formatGoalTime(null)).toBeNull();
        expect(formatGoalTime(0)).toBeNull();
    });
});

describe('round-trip', () => {
    it('km <-> meters preserves whole values', () => {
        expect(metersToKm(kmToMeters(10) as number)).toBe(10);
    });

    it('hms <-> seconds preserves values', () => {
        const sec = hmsToSeconds(3, 45, 30) as number;
        const { hours, minutes, seconds } = secondsToHms(sec);
        expect(hmsToSeconds(hours, minutes, seconds)).toBe(sec);
    });
});
