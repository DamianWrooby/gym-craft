import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    db: { activity: { findMany: vi.fn() } },
}));

vi.mock('$lib/database', () => ({ db: mocks.db }));

import { computeLoadProfile } from './index';

const ASOF = new Date('2026-06-07T12:00:00Z');
const PROFILE = { restingHR: 50, maxHR: 190, sex: 'male' as const };

function activityRow(startTime: string, trimpLoad: number | null = 60) {
    return {
        id: startTime,
        startTime: new Date(startTime),
        durationSec: 1800,
        averageHr: 145,
        hrZone1Sec: null,
        hrZone2Sec: null,
        hrZone3Sec: null,
        hrZone4Sec: null,
        hrZone5Sec: null,
        trimpLoad,
    };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('computeLoadProfile', () => {
    it('excludes non-training activities from the load window', async () => {
        mocks.db.activity.findMany.mockResolvedValue([activityRow('2026-06-06T07:00:00Z')]);

        await computeLoadProfile('user-1', ASOF, PROFILE);

        // Move IQ auto-logs walks. They rarely carry HR zones, so they would score a flat
        // 2 TRIMP/min via the duration fallback and pad the 28-day chronic baseline —
        // which depresses ACWR and makes the report recommend training harder.
        const [args] = mocks.db.activity.findMany.mock.calls[0];
        expect(args.where.activityType).toEqual({ notIn: ['walking'] });
    });

    it('bounds the query to the chronic window plus the previous week', async () => {
        mocks.db.activity.findMany.mockResolvedValue([]);

        await computeLoadProfile('user-1', ASOF, PROFILE);

        const [args] = mocks.db.activity.findMany.mock.calls[0];
        expect(args.where.startTime.gte).toBeInstanceOf(Date);
        expect(args.where.startTime.lt).toBeInstanceOf(Date);
        expect(args.select.raw).toBeUndefined();
    });

    it('counts every training modality toward load, not just running', async () => {
        // Systemic by design: a hard ride is stress whether or not it was a run.
        // See docs/adr/0003-training-load-scope-and-modalities.md.
        mocks.db.activity.findMany.mockResolvedValue([
            activityRow('2026-06-06T07:00:00Z', 80),
            activityRow('2026-06-05T07:00:00Z', 120),
        ]);

        const profile = await computeLoadProfile('user-1', ASOF, PROFILE);

        expect(profile.weeklyTotalLoad).toBe(200);
        // The query never filters by modality, so cycling and swimming rows reach the engine.
        const [args] = mocks.db.activity.findMany.mock.calls[0];
        expect(args.where.activityType).toEqual({ notIn: ['walking'] });
        expect(Object.keys(args.where)).not.toContain('OR');
    });
});
