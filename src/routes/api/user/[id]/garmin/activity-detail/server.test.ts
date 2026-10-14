import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    storeActivityDetail: vi.fn(),
    scoreRunFromSamples: vi.fn(),
}));

vi.mock('$lib/database', () => ({ db: { activity: { findUnique: mocks.findUnique } } }));
vi.mock('$lib/server/garmin/ensure-activity-detail', () => ({ storeActivityDetail: mocks.storeActivityDetail }));
vi.mock('$lib/server/garmin/score-runs', () => ({ scoreRunFromSamples: mocks.scoreRunFromSamples }));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;
const samples = [
    { timestampSec: 0, heartRate: 150 },
    { timestampSec: 600, heartRate: 150 },
];

function makePost(body: unknown, id: string = userId) {
    const request = new Request(`http://localhost/api/user/${id}/garmin/activity-detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return POST({ request, params: { id }, locals });
}

afterEach(() => vi.clearAllMocks());

describe('POST /api/user/[id]/garmin/activity-detail', () => {
    it('returns 403 for another user', async () => {
        const res = await makePost({ garminActivityId: '1', detail: { samples } }, 'someone-else');
        expect(res.status).toBe(403);
    });

    it('rejects a malformed body', async () => {
        expect((await makePost({ garminActivityId: 'abc', detail: { samples } })).status).toBe(400);
        expect((await makePost({ garminActivityId: '1', detail: {} })).status).toBe(400);
        expect((await makePost({ garminActivityId: '1', detail: { activityId: 2, samples } })).status).toBe(400);
        expect(mocks.storeActivityDetail).not.toHaveBeenCalled();
    });

    it('returns 404 when the activity is not the user’s', async () => {
        mocks.findUnique.mockResolvedValue(null);

        const res = await makePost({ garminActivityId: '7', detail: { samples } });

        expect(res.status).toBe(404);
        expect(mocks.findUnique.mock.calls[0][0].where).toEqual({
            userId_garminActivityId: { userId, garminActivityId: BigInt(7) },
        });
    });

    it('stores the detail and scores a run against the athlete zones', async () => {
        mocks.findUnique.mockResolvedValue({ id: 'act-1', activityType: 'running' });
        mocks.scoreRunFromSamples.mockResolvedValue(true);

        const res = await makePost({ garminActivityId: '7', detail: { activityId: 7, samples } });

        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ scored: true });
        expect(mocks.storeActivityDetail).toHaveBeenCalledWith(
            'act-1',
            expect.objectContaining({ samples: expect.any(Array) }),
        );
        expect(mocks.scoreRunFromSamples).toHaveBeenCalledWith(userId, 'act-1', expect.any(Array));
    });

    it('stores but does not score a non-run', async () => {
        mocks.findUnique.mockResolvedValue({ id: 'act-2', activityType: 'cycling' });

        const res = await makePost({ garminActivityId: '8', detail: { samples } });

        expect((await res.json()).data).toEqual({ scored: false });
        expect(mocks.storeActivityDetail).toHaveBeenCalled();
        expect(mocks.scoreRunFromSamples).not.toHaveBeenCalled();
    });
});
