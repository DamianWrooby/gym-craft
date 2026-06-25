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

import { ensureActivityDetail } from './ensure-activity-detail';

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
    detail: { splits: [{ splitIndex: 0 }], samples: [{ timestampSec: 0 }] },
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
};

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
        // Metadata comes from the activity row; splits/samples from the fresh fetch.
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
});
