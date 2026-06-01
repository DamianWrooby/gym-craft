import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    db: {
        activity: { findMany: vi.fn() },
        garminSyncState: { findUnique: vi.fn() },
    },
}));

vi.mock('$lib/database', () => ({ db: mocks.db }));

import { load } from './+page.server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

afterEach(() => {
    vi.clearAllMocks();
});

describe('load /app/running/analytics', () => {
    it('redirects to /app/login when there is no session user', async () => {
        const noLocals = { user: undefined } as unknown as App.Locals;
        await expect(load({ locals: noLocals })).rejects.toMatchObject({ status: 302 });
    });

    it('returns the user activities ordered by startTime desc as list items', async () => {
        mocks.db.activity.findMany.mockResolvedValueOnce([
            {
                id: 'a-1',
                userId,
                garminActivityId: BigInt(111),
                activityType: 'running',
                activityName: 'Run A',
                startTime: new Date('2026-05-20T07:00:00Z'),
                durationSec: 1800,
                movingDurationSec: 1800,
                distanceM: 5000,
                calories: 350,
                averageHr: 145,
                maxHr: 170,
                hrZone1Sec: null,
                hrZone2Sec: null,
                hrZone3Sec: null,
                hrZone4Sec: null,
                hrZone5Sec: null,
                moderateMinutes: null,
                vigorousMinutes: null,
                averageSpeed: 2.78,
                maxSpeed: 3.5,
                averageCadence: 175,
                maxCadence: 190,
                avgStrideLength: 1.2,
                elevationGainM: 25,
                elevationLossM: 25,
                trimpLoad: 40,
                raw: {},
                fetchedAt: new Date(),
            },
        ]);
        mocks.db.garminSyncState.findUnique.mockResolvedValueOnce({
            userId,
            lastSyncedAt: new Date('2026-05-21T11:00:00Z'),
            oldestActivityAt: new Date('2026-02-20T00:00:00Z'),
            backfillComplete: true,
            updatedAt: new Date(),
        });

        const result = await load({ locals });

        expect(mocks.db.activity.findMany).toHaveBeenCalledWith({
            where: { userId },
            orderBy: { startTime: 'desc' },
        });
        expect(result.activities).toHaveLength(1);
        expect(result.activities[0].id).toBe('a-1');
        expect(result.activities[0].garminActivityId).toBe('111');
        expect(result.lastSyncedAt).toBe('2026-05-21T11:00:00.000Z');
        expect(result.needsInitialSync).toBe(false);
    });

    it('returns needsInitialSync=true when there is no sync state row', async () => {
        mocks.db.activity.findMany.mockResolvedValueOnce([]);
        mocks.db.garminSyncState.findUnique.mockResolvedValueOnce(null);

        const result = await load({ locals });

        expect(result.activities).toEqual([]);
        expect(result.lastSyncedAt).toBeNull();
        expect(result.needsInitialSync).toBe(true);
    });

    it('returns needsInitialSync=true when backfill is incomplete', async () => {
        mocks.db.activity.findMany.mockResolvedValueOnce([]);
        mocks.db.garminSyncState.findUnique.mockResolvedValueOnce({
            userId,
            lastSyncedAt: null,
            oldestActivityAt: null,
            backfillComplete: false,
            updatedAt: new Date(),
        });

        const result = await load({ locals });
        expect(result.needsInitialSync).toBe(true);
    });
});
