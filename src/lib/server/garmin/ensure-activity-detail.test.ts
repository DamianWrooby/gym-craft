import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchActivityDetail: vi.fn(),
    upsert: vi.fn(),
}));

vi.mock('$lib/database', () => ({
    db: { activityDetail: { upsert: mocks.upsert } },
}));

vi.mock('./fetch-activity-detail', () => ({
    fetchActivityDetail: mocks.fetchActivityDetail,
}));

import { CURRENT_DETAIL_SCHEMA_VERSION, ensureActivityDetail } from './ensure-activity-detail';

const userId = 'user-1';

const metadata = {
    activityName: 'Tempo run',
    activityType: 'running',
    startTime: new Date('2026-05-05T07:00:00Z'),
    durationSec: 1800,
    distanceM: 5000,
};

const cachedActivity = {
    id: 'act-db-1',
    garminActivityId: 123n,
    ...metadata,
    detail: {
        splits: [{ splitIndex: 0 }],
        samples: [{ timestampSec: 0 }],
        route: [],
        dynamics: null,
        schemaVersion: CURRENT_DETAIL_SCHEMA_VERSION,
    },
};

const freshActivity = {
    id: 'act-db-2',
    garminActivityId: 456n,
    ...metadata,
    detail: null,
};

const fetchedDetail = {
    activityId: 456,
    activityName: 'Tempo run',
    activityType: 'running',
    startTimeGMT: '2026-05-05 07:00:00',
    duration: 1800,
    distance: 5000,
    splits: [{ splitIndex: 0, distanceM: 1000, durationSec: 300 }],
    samples: [{ timestampSec: 0, heartRate: 140, speed: 3.3, elevationM: 10 }],
    route: [{ lat: 52.23, lng: 21.01 }],
    dynamics: {
        avgCadence: 170,
        maxCadence: 185,
        avgGroundContactTimeMs: 240,
        avgVerticalOscillationCm: 8.2,
        avgVerticalRatioPct: 6.1,
        avgPowerW: 250,
        maxPowerW: 310,
        minTemperatureC: 15,
        maxTemperatureC: 18,
    },
};

function makeActivityWithDetail({
    id = 'act-db-3',
    garminActivityId = 789n,
    detail,
}: {
    id?: string;
    garminActivityId?: bigint;
    detail: { splits: unknown[]; samples: unknown[]; route: unknown[]; dynamics: unknown; schemaVersion: number };
}) {
    return { id, garminActivityId, ...metadata, detail };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('ensureActivityDetail', () => {
    it('short-circuits and returns the cached payload without a Garmin call', async () => {
        const result = await ensureActivityDetail(userId, cachedActivity);

        expect(result).toEqual({
            ok: true,
            detail: {
                activityId: 123,
                activityName: 'Tempo run',
                activityType: 'running',
                startTimeGMT: '2026-05-05T07:00:00.000Z',
                duration: 1800,
                distance: 5000,
                splits: cachedActivity.detail.splits,
                samples: cachedActivity.detail.samples,
                route: [],
                dynamics: null,
            },
        });
        expect(mocks.fetchActivityDetail).not.toHaveBeenCalled();
        expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it('fetches, upserts, and returns the assembled payload when none is cached', async () => {
        mocks.fetchActivityDetail.mockResolvedValue({ ok: true, detail: fetchedDetail });

        const result = await ensureActivityDetail(userId, freshActivity);

        expect(mocks.fetchActivityDetail).toHaveBeenCalledWith({
            userId,
            garminActivityId: 456n,
        });
        expect(mocks.upsert).toHaveBeenCalledTimes(1);
        const upsertArg = mocks.upsert.mock.calls[0][0];
        expect(upsertArg.where).toEqual({ activityId: 'act-db-2' });
        expect(upsertArg.create.splits).toEqual(fetchedDetail.splits);
        expect(upsertArg.create.route).toEqual(fetchedDetail.route);
        expect(upsertArg.create.dynamics).toEqual(fetchedDetail.dynamics);
        expect(upsertArg.create.schemaVersion).toBe(CURRENT_DETAIL_SCHEMA_VERSION);
        expect(upsertArg.update.schemaVersion).toBe(CURRENT_DETAIL_SCHEMA_VERSION);
        // Metadata comes from the activity row; splits/samples/route/dynamics from the fresh fetch.
        expect(result).toEqual({
            ok: true,
            detail: {
                activityId: 456,
                activityName: 'Tempo run',
                activityType: 'running',
                startTimeGMT: '2026-05-05T07:00:00.000Z',
                duration: 1800,
                distance: 5000,
                splits: fetchedDetail.splits,
                samples: fetchedDetail.samples,
                route: fetchedDetail.route,
                dynamics: fetchedDetail.dynamics,
            },
        });
    });

    it('propagates a fetch failure without upserting', async () => {
        mocks.fetchActivityDetail.mockResolvedValue({
            ok: false,
            status: 401,
            code: 'INVALID_TOKEN',
            message: 'No valid token found',
        });

        const result = await ensureActivityDetail(userId, freshActivity);

        expect(result).toEqual({ ok: false, status: 401, code: 'INVALID_TOKEN', message: 'No valid token found' });
        expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it('re-fetches when the cached detail predates the current schema version', async () => {
        mocks.fetchActivityDetail.mockResolvedValue({ ok: true, detail: fetchedDetail });
        const activity = makeActivityWithDetail({
            detail: { splits: [], samples: [], route: [], dynamics: null, schemaVersion: 1 },
        });

        const result = await ensureActivityDetail(userId, activity);

        expect(mocks.fetchActivityDetail).toHaveBeenCalledOnce();
        expect(result.ok).toBe(true);
    });

    it('short-circuits when the cached detail is at the current schema version', async () => {
        const activity = makeActivityWithDetail({
            detail: {
                splits: [],
                samples: [],
                route: [],
                dynamics: null,
                schemaVersion: CURRENT_DETAIL_SCHEMA_VERSION,
            },
        });

        const result = await ensureActivityDetail(userId, activity);

        expect(mocks.fetchActivityDetail).not.toHaveBeenCalled();
        expect(result.ok).toBe(true);
    });
});
