import { describe, expect, it } from 'vitest';
import { resolveSyncWindow } from './sync-window';

const now = new Date('2026-06-02T12:00:00Z');

describe('resolveSyncWindow', () => {
    it('returns a 90-day backfill window when there is no sync state', () => {
        const result = resolveSyncWindow(null, now);
        expect(result.mode).toBe('backfill');
        expect(result.endDate).toBe('2026-06-02');
        expect(result.startDate).toBe('2026-03-04'); // 90 days before
    });

    it('returns a backfill window when backfill is not yet complete', () => {
        const result = resolveSyncWindow({ backfillComplete: false, lastSyncedAt: '2026-05-30T00:00:00Z' }, now);
        expect(result.mode).toBe('backfill');
        expect(result.startDate).toBe('2026-03-04');
    });

    it('returns a 7-day incremental window when backfilled but never synced after', () => {
        const result = resolveSyncWindow({ backfillComplete: true, lastSyncedAt: null }, now);
        expect(result.mode).toBe('incremental');
        expect(result.startDate).toBe('2026-05-26'); // 7 days before
        expect(result.endDate).toBe('2026-06-02');
    });

    it('returns lastSyncedAt minus one day for an incremental sync', () => {
        const result = resolveSyncWindow({ backfillComplete: true, lastSyncedAt: '2026-06-01T08:00:00Z' }, now);
        expect(result.mode).toBe('incremental');
        expect(result.startDate).toBe('2026-05-31'); // 1-day overlap
    });
});
