import { describe, expect, it } from 'vitest';
import { resolveSyncWindow } from './sync-window';

const now = new Date('2026-06-02T12:00:00Z');

describe('resolveSyncWindow', () => {
    it('returns a backfill window of the given length when there is no sync state', () => {
        const result = resolveSyncWindow(null, 60, now);
        expect(result.mode).toBe('backfill');
        expect(result.endDate).toBe('2026-06-02');
        expect(result.startDate).toBe('2026-04-03'); // 60 days before
    });

    it('returns a backfill window when backfill is not yet complete', () => {
        const result = resolveSyncWindow({ backfillComplete: false, lastSyncedAt: '2026-05-30T00:00:00Z' }, 60, now);
        expect(result.mode).toBe('backfill');
        expect(result.startDate).toBe('2026-04-03');
    });

    it('uses the provided backfillDays for the backfill window', () => {
        const fixedNow = new Date('2026-07-01T00:00:00Z');
        const sixty = resolveSyncWindow(null, 60, fixedNow);
        const oneTwenty = resolveSyncWindow(null, 120, fixedNow);
        expect(sixty.startDate).toBe('2026-05-02');
        expect(oneTwenty.startDate).toBe('2026-03-03');
    });

    it('returns a 7-day incremental window when backfilled but never synced after', () => {
        const result = resolveSyncWindow({ backfillComplete: true, lastSyncedAt: null }, 60, now);
        expect(result.mode).toBe('incremental');
        expect(result.startDate).toBe('2026-05-26'); // 7 days before
        expect(result.endDate).toBe('2026-06-02');
    });

    it('returns lastSyncedAt minus one day for an incremental sync', () => {
        const result = resolveSyncWindow({ backfillComplete: true, lastSyncedAt: '2026-06-01T08:00:00Z' }, 60, now);
        expect(result.mode).toBe('incremental');
        expect(result.startDate).toBe('2026-05-31'); // 1-day overlap
    });
});
