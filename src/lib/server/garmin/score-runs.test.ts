import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    db: {
        activity: { findMany: vi.fn(), update: vi.fn() },
        athleteProfile: { findUnique: vi.fn() },
        planWeek: { update: vi.fn(), updateMany: vi.fn() },
    },
}));

vi.mock('$lib/database', () => ({ db: mocks.db }));

import { rebinRunsAfterSync, rescoreIfZonesChanged, rescoreRunsForZoneChange, scoreRunFromSamples } from './score-runs';

const zones = [
    { zone: 1, lowerBpm: 100, upperBpm: 120 },
    { zone: 2, lowerBpm: 121, upperBpm: 140 },
    { zone: 3, lowerBpm: 141, upperBpm: 160 },
    { zone: 4, lowerBpm: 161, upperBpm: 175 },
    { zone: 5, lowerBpm: 176, upperBpm: 190 },
];
// 600 s in the athlete's zone 2: Edwards 10 min x 2 = 20.
const samples = [
    { timestampSec: 0, heartRate: 130 },
    { timestampSec: 600, heartRate: 130 },
];
const now = new Date('2026-10-14T12:00:00Z');

function run(id: string, overrides: Record<string, unknown> = {}) {
    return { id, activityType: 'running', detail: null, ...overrides };
}

afterEach(() => vi.clearAllMocks());

describe('rebinRunsAfterSync', () => {
    it('re-bins flagged runs with stored samples against the profile zones', async () => {
        mocks.db.athleteProfile.findUnique.mockResolvedValue({ hrZoneBounds: zones });
        mocks.db.activity.findMany.mockResolvedValue([run('a1', { detail: { samples } })]);

        const result = await rebinRunsAfterSync('user-1', now);

        expect(result).toEqual({ scored: 1, needsDetail: [] });
        const where = mocks.db.activity.findMany.mock.calls[0][0].where;
        expect(where.zoneSource).toBe('GARMIN_ZONES');
        expect(where.startTime.gte.toISOString()).toBe('2026-09-02T12:00:00.000Z');
        expect(mocks.db.activity.update).toHaveBeenCalledWith({
            where: { id: 'a1' },
            data: { trimpLoad: 20, loadMethod: 'EDWARDS', zoneSource: 'ATHLETE_ZONES' },
        });
    });

    it('returns runs without stored samples for the browser to fetch, with no cap', async () => {
        mocks.db.athleteProfile.findUnique.mockResolvedValue({ hrZoneBounds: zones });
        const missing = Array.from({ length: 30 }, (_, i) => run(`m${i}`, { garminActivityId: BigInt(1000 + i) }));
        mocks.db.activity.findMany.mockResolvedValue([run('ride', { activityType: 'cycling' }), ...missing]);

        const result = await rebinRunsAfterSync('user-1', now);

        expect(result.scored).toBe(0);
        expect(result.needsDetail).toHaveLength(30);
        expect(result.needsDetail[0]).toBe('1000');
        expect(mocks.db.activity.update).not.toHaveBeenCalled();
    });

    it('keeps the flag when stored samples carry no heart rate', async () => {
        mocks.db.athleteProfile.findUnique.mockResolvedValue({ hrZoneBounds: zones });
        const noHr = [
            { timestampSec: 0, heartRate: null },
            { timestampSec: 60, heartRate: null },
        ];
        mocks.db.activity.findMany.mockResolvedValue([run('a1', { detail: { samples: noHr } })]);

        expect(await rebinRunsAfterSync('user-1', now)).toEqual({ scored: 0, needsDetail: [] });
        expect(mocks.db.activity.update).not.toHaveBeenCalled();
    });

    it('does nothing without confirmed profile zones', async () => {
        mocks.db.athleteProfile.findUnique.mockResolvedValue({ hrZoneBounds: null });

        expect(await rebinRunsAfterSync('user-1', now)).toEqual({ scored: 0, needsDetail: [] });
        expect(mocks.db.activity.findMany).not.toHaveBeenCalled();
    });
});

describe('scoreRunFromSamples', () => {
    it('scores a run against the profile zones', async () => {
        mocks.db.athleteProfile.findUnique.mockResolvedValue({ hrZoneBounds: zones });

        expect(await scoreRunFromSamples('user-1', 'a1', samples)).toBe(true);
        expect(mocks.db.activity.update).toHaveBeenCalledWith({
            where: { id: 'a1' },
            data: { trimpLoad: 20, loadMethod: 'EDWARDS', zoneSource: 'ATHLETE_ZONES' },
        });
    });

    it('leaves the run on Garmin zones without confirmed profile zones', async () => {
        mocks.db.athleteProfile.findUnique.mockResolvedValue(null);

        expect(await scoreRunFromSamples('user-1', 'a1', samples)).toBe(false);
        expect(mocks.db.activity.update).not.toHaveBeenCalled();
    });
});

describe('rescoreRunsForZoneChange', () => {
    it('re-scores window runs from stored samples and leaves frozen budgets untouched', async () => {
        mocks.db.activity.findMany.mockResolvedValue([
            { id: 'a1', activityType: 'running', detail: { samples } },
            { id: 'lift', activityType: 'strength_training', detail: { samples } },
        ]);
        const newZones = [
            { zone: 1, lowerBpm: 100, upperBpm: 135 },
            { zone: 2, lowerBpm: 136, upperBpm: 145 },
            ...zones.slice(2),
        ];

        const scored = await rescoreRunsForZoneChange('user-1', newZones, now);

        expect(scored).toBe(1);
        // 600 s now in zone 1: 10.
        expect(mocks.db.activity.update).toHaveBeenCalledWith({
            where: { id: 'a1' },
            data: { trimpLoad: 10, loadMethod: 'EDWARDS', zoneSource: 'ATHLETE_ZONES' },
        });
        expect(mocks.db.planWeek.update).not.toHaveBeenCalled();
        expect(mocks.db.planWeek.updateMany).not.toHaveBeenCalled();
        expect(mocks.db.activity.findMany.mock.calls[0][0].where.detail).toEqual({ isNot: null });
    });
});

describe('rescoreIfZonesChanged', () => {
    it('re-scores only when valid zones differ from the stored ones', async () => {
        mocks.db.activity.findMany.mockResolvedValue([]);

        await rescoreIfZonesChanged('user-1', zones, zones);
        await rescoreIfZonesChanged('user-1', null, [{ zone: 1 }]);
        expect(mocks.db.activity.findMany).not.toHaveBeenCalled();

        await rescoreIfZonesChanged('user-1', null, zones);
        expect(mocks.db.activity.findMany).toHaveBeenCalledTimes(1);
    });

    it('swallows a failure so the profile write still succeeds', async () => {
        mocks.db.activity.findMany.mockRejectedValue(new Error('db down'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(rescoreIfZonesChanged('user-1', null, zones)).resolves.toBeUndefined();
        spy.mockRestore();
    });
});
