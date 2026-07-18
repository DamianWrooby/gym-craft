import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickIncrementalStart } from '$lib/garmin/sync-window';
import { computeTrimp } from '$lib/server/analytics/load/trimp';
import type { GarminActivity } from '@/models/garmin/activity.model';

const mocks = vi.hoisted(() => ({
    db: {
        activity: { upsert: vi.fn() },
        athleteProfile: { findUnique: vi.fn() },
        garminSyncState: { update: vi.fn(), upsert: vi.fn() },
        $transaction: vi.fn(async (ops: unknown[]) => ops),
    },
}));

vi.mock('$lib/database', () => ({ db: mocks.db }));
vi.mock('./fetch-activities', () => ({ fetchGarminActivities: vi.fn() }));

import { persistActivities } from './sync-activities';

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

describe('persistActivities', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    const garminActivity = {
        activityId: 123456,
        activityName: 'Morning Run',
        activityType: { typeKey: 'running' },
        startTimeLocal: '2026-07-16 07:00:00',
        startTimeGMT: '2026-07-16 05:00:00',
        beginTimestamp: 1784178000000,
        duration: 1800,
        distance: 5000,
        averageHR: 145,
    } as unknown as GarminActivity;

    it('computes trimpLoad at write time from the athlete profile, on create and update alike', async () => {
        mocks.db.athleteProfile.findUnique.mockResolvedValueOnce({ restingHR: 50, maxHR: 190, sex: 'MALE' });
        mocks.db.garminSyncState.update.mockResolvedValueOnce({});

        const result = await persistActivities('user-1', [garminActivity], 'incremental', 0);

        expect(result.ok).toBe(true);
        expect(mocks.db.activity.upsert).toHaveBeenCalledTimes(1);
        const upsertArgs = mocks.db.activity.upsert.mock.calls[0][0];
        const expectedTrimp = computeTrimp({
            durationSec: 1800,
            hrZoneSeconds: null,
            averageHr: 145,
            restingHr: 50,
            maxHr: 190,
            sex: 'male',
        });
        expect(expectedTrimp).toBeGreaterThan(0);
        expect(upsertArgs.create.trimpLoad).toBe(expectedTrimp);
        // Updates recompute deterministically from the same inputs, so re-syncs can never
        // regress a row back to a null load.
        expect(upsertArgs.update.trimpLoad).toBe(expectedTrimp);
    });

    it('falls back to a duration-based trimpLoad when the user has no athlete profile', async () => {
        mocks.db.athleteProfile.findUnique.mockResolvedValueOnce(null);
        mocks.db.garminSyncState.update.mockResolvedValueOnce({});

        const result = await persistActivities('user-1', [garminActivity], 'incremental', 0);

        expect(result.ok).toBe(true);
        const upsertArgs = mocks.db.activity.upsert.mock.calls[0][0];
        expect(upsertArgs.create.trimpLoad).toBe(60); // 30 min * 2
    });
});
