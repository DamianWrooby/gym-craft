import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    findFirst: vi.fn(),
    ensureActivityDetail: vi.fn(),
}));

vi.mock('$lib/database', () => ({
    db: { activity: { findFirst: mocks.findFirst } },
}));

vi.mock('$lib/server/garmin/ensure-activity-detail', () => ({
    ensureActivityDetail: mocks.ensureActivityDetail,
}));

import { POST } from './+server';

const userId = 'user-1';
const activityId = 'act-db-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

const activityRow = { id: activityId, garminActivityId: 123n, detail: null };
const splits = [{ splitIndex: 0, distanceM: 1000, durationSec: 300 }];
const samples = [{ timestampSec: 0, heartRate: 140, speed: 3.3, elevationM: 10 }];
// ensureActivityDetail returns the full payload; the endpoint projects it down to the time-series.
const payload = {
    activityId: 123,
    activityName: 'Tempo run',
    activityType: 'running',
    startTimeGMT: '2026-05-05T07:00:00.000Z',
    duration: 1800,
    distance: 5000,
    splits,
    samples,
};

function makePost(body: unknown = {}, id: string = userId, actId: string = activityId) {
    const request = new Request(`http://localhost/api/user/${id}/activities/${actId}/detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return POST({ request, params: { id, activityId: actId }, locals });
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/activities/[activityId]/detail', () => {
    it('returns 403 when the path user does not match the session user', async () => {
        const res = await makePost({}, 'someone-else');
        expect(res.status).toBe(403);
        expect(mocks.findFirst).not.toHaveBeenCalled();
    });

    it('returns 404 when the activity is not found', async () => {
        mocks.findFirst.mockResolvedValue(null);
        const res = await makePost();
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.code).toBe('ACTIVITY_NOT_FOUND');
        expect(mocks.ensureActivityDetail).not.toHaveBeenCalled();
    });

    it('returns only the splits + samples time-series on success', async () => {
        mocks.findFirst.mockResolvedValue(activityRow);
        mocks.ensureActivityDetail.mockResolvedValue({ ok: true, detail: payload });
        const res = await makePost();
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.detail).toEqual({ splits, samples });
    });

    it('forwards the password to ensureActivityDetail for re-auth', async () => {
        mocks.findFirst.mockResolvedValue(activityRow);
        mocks.ensureActivityDetail.mockResolvedValue({ ok: true, detail: payload });
        await makePost({ password: 'secret' });
        expect(mocks.ensureActivityDetail).toHaveBeenCalledWith(userId, activityRow, 'secret');
    });

    it('surfaces INVALID_TOKEN from the fetch with its status and code', async () => {
        mocks.findFirst.mockResolvedValue(activityRow);
        mocks.ensureActivityDetail.mockResolvedValue({
            ok: false,
            status: 401,
            code: 'INVALID_TOKEN',
            message: 'No valid token found',
        });
        const res = await makePost();
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.code).toBe('INVALID_TOKEN');
    });
});
