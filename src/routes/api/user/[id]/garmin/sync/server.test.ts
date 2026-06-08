import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    persistActivities: vi.fn(),
    syncUserActivities: vi.fn(),
}));

vi.mock('$lib/database', () => ({
    db: { garminSyncState: { findUnique: mocks.findUnique } },
}));

vi.mock('$lib/server/garmin/sync-activities', () => ({
    persistActivities: mocks.persistActivities,
    syncUserActivities: mocks.syncUserActivities,
}));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

function makePost(body: unknown, id: string = userId) {
    const request = new Request(`http://localhost/api/user/${id}/garmin/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return POST({ request, params: { id }, locals });
}

function rawActivity(activityId: number) {
    return {
        activityId,
        activityName: 'Morning Run',
        activityType: { typeKey: 'running' },
        startTimeLocal: '2026-05-12 06:00:00',
        startTimeGMT: '2026-05-12 04:00:00',
        beginTimestamp: Date.parse('2026-05-12T04:00:00Z'),
        duration: 1800,
        distance: 5000,
        calories: 300,
    };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/garmin/sync', () => {
    it('returns 403 when the path user does not match the session user', async () => {
        const res = await makePost({ activities: [] }, 'someone-else');
        expect(res.status).toBe(403);
    });

    it('persists in backfill mode when backfill is not yet complete', async () => {
        mocks.findUnique.mockResolvedValue(null);
        mocks.persistActivities.mockResolvedValue({
            ok: true,
            mode: 'backfill',
            activitiesUpserted: 1,
            lastSyncedAt: new Date('2026-06-02T12:00:00Z'),
        });

        const res = await makePost({ activities: [rawActivity(1)], mode: 'backfill' });
        const payload = await res.json();

        expect(res.status).toBe(200);
        expect(payload.data.mode).toBe('backfill');
        expect(mocks.persistActivities).toHaveBeenCalledWith(userId, expect.any(Array), 'backfill');
        expect(mocks.syncUserActivities).not.toHaveBeenCalled();
    });

    it('persists in incremental mode when backfill is complete', async () => {
        mocks.findUnique.mockResolvedValue({ backfillComplete: true });
        mocks.persistActivities.mockResolvedValue({
            ok: true,
            mode: 'incremental',
            activitiesUpserted: 0,
            lastSyncedAt: new Date('2026-06-02T12:00:00Z'),
        });

        const res = await makePost({ activities: [rawActivity(1)], mode: 'incremental' });
        const payload = await res.json();

        expect(res.status).toBe(200);
        expect(payload.data.mode).toBe('incremental');
        expect(mocks.persistActivities).toHaveBeenCalledWith(userId, expect.any(Array), 'incremental');
    });

    it('returns 409 STALE_STATE when the client mode disagrees with the server', async () => {
        mocks.findUnique.mockResolvedValue({ backfillComplete: true }); // server: incremental

        const res = await makePost({ activities: [rawActivity(1)], mode: 'backfill' });
        const payload = await res.json();

        expect(res.status).toBe(409);
        expect(payload.code).toBe('STALE_STATE');
        expect(mocks.persistActivities).not.toHaveBeenCalled();
    });

    it('rejects an oversized activity list with 400', async () => {
        const activities = Array.from({ length: 1501 }, (_, i) => rawActivity(i));
        const res = await makePost({ activities });
        const payload = await res.json();

        expect(res.status).toBe(400);
        expect(payload.code).toBe('INVALID_PAYLOAD');
        expect(mocks.persistActivities).not.toHaveBeenCalled();
    });

    it('rejects malformed activities with 400', async () => {
        mocks.findUnique.mockResolvedValue(null);
        const res = await makePost({ activities: [{ noActivityId: true }] });
        const payload = await res.json();

        expect(res.status).toBe(400);
        expect(payload.code).toBe('INVALID_PAYLOAD');
    });

    it('returns 500 PERSIST_FAILED when persistence throws', async () => {
        mocks.findUnique.mockResolvedValue(null);
        mocks.persistActivities.mockRejectedValue(new Error('db down'));

        const res = await makePost({ activities: [rawActivity(1)] });
        const payload = await res.json();

        expect(res.status).toBe(500);
        expect(payload.code).toBe('PERSIST_FAILED');
    });

    it('falls back to server-side sync when no activities are supplied', async () => {
        mocks.syncUserActivities.mockResolvedValue({
            ok: true,
            mode: 'incremental',
            activitiesUpserted: 2,
            lastSyncedAt: new Date('2026-06-02T12:00:00Z'),
        });

        const res = await makePost({ password: 'secret' });
        const payload = await res.json();

        expect(res.status).toBe(200);
        expect(mocks.syncUserActivities).toHaveBeenCalledWith(userId, 'secret');
        expect(mocks.persistActivities).not.toHaveBeenCalled();
        expect(payload.data.activitiesUpserted).toBe(2);
    });
});
