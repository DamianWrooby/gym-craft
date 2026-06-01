import { describe, expect, it } from 'vitest';
import { isSyncStale, SYNC_STALE_AFTER_MS } from './sync-staleness';

describe('isSyncStale', () => {
    const now = new Date('2026-05-21T12:00:00Z');

    it('is stale when lastSyncedAt is null', () => {
        expect(isSyncStale(null, now)).toBe(true);
    });

    it('is stale when lastSyncedAt is older than the threshold', () => {
        const old = new Date(now.getTime() - SYNC_STALE_AFTER_MS - 1000);
        expect(isSyncStale(old, now)).toBe(true);
    });

    it('is fresh when lastSyncedAt is within the threshold', () => {
        const recent = new Date(now.getTime() - 60 * 1000);
        expect(isSyncStale(recent, now)).toBe(false);
    });

    it('threshold is 15 minutes', () => {
        expect(SYNC_STALE_AFTER_MS).toBe(15 * 60 * 1000);
    });
});
