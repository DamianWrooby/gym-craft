import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickIncrementalStart } from '$lib/garmin/sync-window';
import { computeTrimp } from '$lib/server/analytics/load/trimp';
import type { GarminActivity } from '@/models/garmin/activity.model';

const mocks = vi.hoisted(() => ({
    db: {
        activity: { upsert: vi.fn(), findMany: vi.fn(async () => [] as unknown[]), update: vi.fn() },
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

    describe('re-binning runs against athlete zones', () => {
        const zones = [
            { zone: 1, lowerBpm: 100, upperBpm: 120 },
            { zone: 2, lowerBpm: 121, upperBpm: 140 },
            { zone: 3, lowerBpm: 141, upperBpm: 160 },
            { zone: 4, lowerBpm: 161, upperBpm: 175 },
            { zone: 5, lowerBpm: 176, upperBpm: 190 },
        ];
        const storedRun = { id: 'act-1', garminActivityId: BigInt(123456), activityType: 'running', detail: null };

        it('writes a new run on Garmin zones and returns it for the browser to fetch detail', async () => {
            mocks.db.athleteProfile.findUnique
                .mockResolvedValueOnce({ restingHR: 50, maxHR: 190, sex: 'MALE' })
                .mockResolvedValueOnce({ hrZoneBounds: zones });
            mocks.db.activity.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([storedRun]);
            mocks.db.garminSyncState.update.mockResolvedValueOnce({});

            const result = await persistActivities('user-1', [garminActivity], 'incremental', 0);

            const upsertArgs = mocks.db.activity.upsert.mock.calls[0][0];
            expect(upsertArgs.create.zoneSource).toBe('GARMIN_ZONES');
            expect(upsertArgs.create.loadMethod).toBe('BANISTER');
            expect(result).toMatchObject({ ok: true, runsNeedingDetail: ['123456'] });
            expect(mocks.db.activity.update).not.toHaveBeenCalled();
        });

        it('re-bins a flagged run with stored samples against the profile zones', async () => {
            mocks.db.athleteProfile.findUnique
                .mockResolvedValueOnce({ restingHR: 50, maxHR: 190, sex: 'MALE' })
                .mockResolvedValueOnce({ hrZoneBounds: zones });
            const samples = [
                { timestampSec: 0, heartRate: 150 },
                { timestampSec: 600, heartRate: 150 },
            ];
            mocks.db.activity.findMany
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ ...storedRun, detail: { samples } }]);

            const result = await persistActivities('user-1', [garminActivity], 'incremental', 0);

            // 600 s in the athlete's zone 3: 10 min x 3.
            expect(mocks.db.activity.update).toHaveBeenCalledWith({
                where: { id: 'act-1' },
                data: { trimpLoad: 30, loadMethod: 'EDWARDS', zoneSource: 'ATHLETE_ZONES' },
            });
            expect(result).toMatchObject({ ok: true, runsNeedingDetail: [] });
        });

        it('keeps Garmin load and the flag when re-binning fails, and still completes the sync', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mocks.db.athleteProfile.findUnique
                .mockResolvedValueOnce({ restingHR: 50, maxHR: 190, sex: 'MALE' })
                .mockRejectedValueOnce(new Error('db down'));
            mocks.db.activity.findMany.mockResolvedValueOnce([]);

            const result = await persistActivities('user-1', [garminActivity], 'incremental', 0);

            expect(result).toMatchObject({ ok: true, runsNeedingDetail: [] });
            expect(mocks.db.activity.upsert.mock.calls[0][0].update.zoneSource).toBe('GARMIN_ZONES');
            spy.mockRestore();
        });

        it('does not overwrite a run already scored on athlete zones', async () => {
            mocks.db.athleteProfile.findUnique.mockResolvedValueOnce(null);
            mocks.db.activity.findMany.mockResolvedValueOnce([{ garminActivityId: BigInt(123456) }]);

            await persistActivities('user-1', [garminActivity], 'incremental', 0);

            const upsertArgs = mocks.db.activity.upsert.mock.calls[0][0];
            expect(upsertArgs.update).not.toHaveProperty('trimpLoad');
            expect(upsertArgs.update).not.toHaveProperty('zoneSource');
            expect(upsertArgs.create.trimpLoad).toBe(60);
        });

        it('costs strength at the flat rate with no zone source', async () => {
            mocks.db.athleteProfile.findUnique.mockResolvedValueOnce(null);
            const lift = { ...garminActivity, activityType: { typeKey: 'strength_training' } } as GarminActivity;

            await persistActivities('user-1', [lift], 'incremental', 0);

            const upsertArgs = mocks.db.activity.upsert.mock.calls[0][0];
            expect(upsertArgs.create).toMatchObject({ trimpLoad: 60, loadMethod: 'DURATION', zoneSource: null });
        });
    });
});
