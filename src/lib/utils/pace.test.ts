import { describe, it, expect } from 'vitest';
import { formatPaceOrSpeed, paceSecPerKmFromSpeed, formatPaceSecPerKm } from './pace';

describe('paceSecPerKmFromSpeed', () => {
    it('converts m/s to seconds per km', () => {
        // 3.31 m/s ≈ 5:02 /km
        expect(paceSecPerKmFromSpeed(3.31)).toBe(302);
    });

    it('returns null for zero, negative, null or undefined speed', () => {
        expect(paceSecPerKmFromSpeed(0)).toBeNull();
        expect(paceSecPerKmFromSpeed(-2)).toBeNull();
        expect(paceSecPerKmFromSpeed(null)).toBeNull();
        expect(paceSecPerKmFromSpeed(undefined)).toBeNull();
    });
});

describe('formatPaceSecPerKm', () => {
    it('formats seconds per km as m:ss /km', () => {
        expect(formatPaceSecPerKm(302)).toBe('5:02 /km');
        expect(formatPaceSecPerKm(287)).toBe('4:47 /km');
        expect(formatPaceSecPerKm(600)).toBe('10:00 /km');
    });

    it('returns null for invalid input', () => {
        expect(formatPaceSecPerKm(null)).toBeNull();
        expect(formatPaceSecPerKm(0)).toBeNull();
        expect(formatPaceSecPerKm(Infinity)).toBeNull();
    });
});

describe('formatPaceOrSpeed', () => {
    it('formats pace for running types', () => {
        expect(formatPaceOrSpeed(3.31, 'running')).toBe('5:02 /km');
    });

    it('formats km/h for non-pace types', () => {
        expect(formatPaceOrSpeed(10, 'cycling')).toBe('36.0 km/h');
    });

    it('returns dash for missing speed', () => {
        expect(formatPaceOrSpeed(0, 'running')).toBe('—');
        expect(formatPaceOrSpeed(null, 'running')).toBe('—');
    });
});
