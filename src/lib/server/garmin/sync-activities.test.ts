import { describe, expect, it } from 'vitest';
import { pickIncrementalStart } from './sync-activities';

describe('pickIncrementalStart', () => {
    it('returns endDate - 7 days when lastSyncedAt is null', () => {
        const endDate = new Date('2026-05-21T12:00:00Z');
        const result = pickIncrementalStart(null, endDate);
        const expected = new Date('2026-05-14T12:00:00Z');
        expect(result.toISOString()).toBe(expected.toISOString());
    });

    it('returns lastSyncedAt - 1 day for a recent sync', () => {
        const endDate = new Date('2026-05-21T12:00:00Z');
        const lastSyncedAt = new Date('2026-05-20T08:00:00Z');
        const result = pickIncrementalStart(lastSyncedAt, endDate);
        const expected = new Date('2026-05-19T08:00:00Z');
        expect(result.toISOString()).toBe(expected.toISOString());
    });

    it('returns lastSyncedAt - 1 day even when the gap is greater than 7 days', () => {
        const endDate = new Date('2026-05-21T12:00:00Z');
        const lastSyncedAt = new Date('2026-04-01T00:00:00Z');
        const result = pickIncrementalStart(lastSyncedAt, endDate);
        const expected = new Date('2026-03-31T00:00:00Z');
        expect(result.toISOString()).toBe(expected.toISOString());
    });
});
