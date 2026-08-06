import { describe, expect, it } from 'vitest';

import { MAX_CHUNK_DAYS, splitDateRange } from './date-chunks';

describe('splitDateRange', () => {
    it('keeps a short range as a single window', () => {
        expect(splitDateRange('2026-06-01', '2026-06-08')).toEqual([
            { startDate: '2026-06-01', endDate: '2026-06-08' },
        ]);
    });

    it('splits a backfill-sized range into month-sized windows', () => {
        const chunks = splitDateRange('2026-01-01', '2026-04-30');

        expect(chunks.length).toBe(4);
        expect(chunks[0]).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
        expect(chunks[chunks.length - 1].endDate).toBe('2026-04-30');
    });

    it('produces consecutive, non-overlapping windows that cover the whole range', () => {
        const chunks = splitDateRange('2026-01-01', '2026-04-30');

        expect(chunks[0].startDate).toBe('2026-01-01');
        for (let i = 1; i < chunks.length; i++) {
            const previousEnd = new Date(`${chunks[i - 1].endDate}T00:00:00Z`);
            const currentStart = new Date(`${chunks[i].startDate}T00:00:00Z`);
            expect(currentStart.getTime() - previousEnd.getTime()).toBe(86_400_000);
        }
    });

    it('never exceeds the maximum window length', () => {
        for (const chunk of splitDateRange('2026-01-01', '2026-06-30')) {
            const start = new Date(`${chunk.startDate}T00:00:00Z`);
            const end = new Date(`${chunk.endDate}T00:00:00Z`);
            const days = (end.getTime() - start.getTime()) / 86_400_000 + 1;
            expect(days).toBeLessThanOrEqual(MAX_CHUNK_DAYS);
        }
    });

    it('honours a custom window size', () => {
        expect(splitDateRange('2026-06-01', '2026-06-10', 5)).toEqual([
            { startDate: '2026-06-01', endDate: '2026-06-05' },
            { startDate: '2026-06-06', endDate: '2026-06-10' },
        ]);
    });

    it('falls back to the original range when the dates are unusable', () => {
        expect(splitDateRange('not-a-date', '2026-06-10')).toEqual([
            { startDate: 'not-a-date', endDate: '2026-06-10' },
        ]);
    });
});
