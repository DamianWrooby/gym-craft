import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    db: {
        activity: { findMany: vi.fn(), update: vi.fn() },
        garminSyncState: { findUnique: vi.fn() },
        garminData: { findUnique: vi.fn() },
        athleteProfile: { findUnique: vi.fn() },
        $transaction: vi.fn(async (ops: unknown[]) => ops),
    },
    getWeeklyReports: vi.fn(),
}));

vi.mock('$lib/database', () => ({ db: mocks.db }));
vi.mock('$lib/prisma/prisma', () => ({ getWeeklyReports: mocks.getWeeklyReports }));

import { load } from './+page.server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

function activityRow(id: string, startTime: string, trimpLoad: number | null = 40) {
    return {
        id,
        userId,
        garminActivityId: BigInt(id.replace(/\D/g, '') || '1'),
        activityType: 'running',
        activityName: `Run ${id}`,
        startTime: new Date(startTime),
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
        trimpLoad,
        raw: {},
        fetchedAt: new Date(),
    };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('load /app/running/analytics (dashboard)', () => {
    it('redirects to /app/login when there is no session user', async () => {
        const noLocals = { user: undefined } as unknown as App.Locals;
        await expect(load({ locals: noLocals })).rejects.toMatchObject({ status: 302 });
    });

    it('returns a summary, at most 5 recent activities and 3 recent reports', async () => {
        const rows = Array.from({ length: 8 }, (_, i) => activityRow(`a-${i}`, `2026-06-0${(i % 7) + 1}T07:00:00Z`));
        mocks.db.activity.findMany.mockResolvedValueOnce(rows);
        mocks.db.garminSyncState.findUnique.mockResolvedValueOnce({
            userId,
            lastSyncedAt: new Date('2026-06-07T11:00:00Z'),
            oldestActivityAt: new Date('2026-03-01T00:00:00Z'),
            backfillComplete: true,
            updatedAt: new Date(),
        });
        mocks.db.garminData.findUnique.mockResolvedValueOnce({ email: 'athlete@example.com' });
        mocks.getWeeklyReports.mockResolvedValueOnce([
            {
                id: 'r-1',
                periodStart: '2026-06-01',
                periodEnd: '2026-06-07',
                summary: 'A',
                createdAt: new Date(),
                userId,
                type: 'WEEKLY',
            },
            {
                id: 'r-2',
                periodStart: '2026-05-25',
                periodEnd: '2026-05-31',
                summary: 'B',
                createdAt: new Date(),
                userId,
                type: 'WEEKLY',
            },
            {
                id: 'r-3',
                periodStart: '2026-05-18',
                periodEnd: '2026-05-24',
                summary: 'C',
                createdAt: new Date(),
                userId,
                type: 'WEEKLY',
            },
            {
                id: 'r-4',
                periodStart: '2026-05-11',
                periodEnd: '2026-05-17',
                summary: 'D',
                createdAt: new Date(),
                userId,
                type: 'WEEKLY',
            },
        ]);

        const result = await load({ locals });

        expect(result.recentActivities).toHaveLength(5);
        expect(result.recentReports).toHaveLength(3);
        expect(result.recentReports[0].id).toBe('r-1');
        expect(result.summary.hasActivities).toBe(true);
        expect(result.needsInitialSync).toBe(false);
        expect(result.garminEmail).toBe('athlete@example.com');
        expect(result.lastSyncedAt).toBe('2026-06-07T11:00:00.000Z');
    });

    it('computes and persists TRIMP for synced activities so the load summary is populated', async () => {
        const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
        // Fresh sync: every row still has trimpLoad null; history spans > 28 days.
        const rows = [
            activityRow('a-1', daysAgo(1), null),
            activityRow('a-2', daysAgo(3), null),
            activityRow('a-3', daysAgo(10), null),
            activityRow('a-4', daysAgo(20), null),
            activityRow('a-5', daysAgo(35), null),
        ];
        mocks.db.activity.findMany.mockResolvedValueOnce(rows);
        mocks.db.garminSyncState.findUnique.mockResolvedValueOnce({
            userId,
            lastSyncedAt: new Date(),
            oldestActivityAt: new Date(daysAgo(60)),
            backfillComplete: true,
            updatedAt: new Date(),
        });
        mocks.db.garminData.findUnique.mockResolvedValueOnce({ email: 'athlete@example.com' });
        mocks.db.athleteProfile.findUnique.mockResolvedValueOnce({ restingHR: 50, maxHR: 190, sex: 'MALE' });
        mocks.getWeeklyReports.mockResolvedValueOnce([]);

        const result = await load({ locals });

        expect(result.summary.acwr).toBeGreaterThan(0);
        expect(result.summary.hasSufficientHistory).toBe(true);
        expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
        expect(mocks.db.activity.update).toHaveBeenCalledTimes(5);
        expect(result.recentActivities.every((a) => a.trimpLoad != null && a.trimpLoad > 0)).toBe(true);
    });

    it('flags needsInitialSync and empty previews when there is no data', async () => {
        mocks.db.activity.findMany.mockResolvedValueOnce([]);
        mocks.db.garminSyncState.findUnique.mockResolvedValueOnce(null);
        mocks.db.garminData.findUnique.mockResolvedValueOnce(null);
        mocks.getWeeklyReports.mockResolvedValueOnce([]);

        const result = await load({ locals });

        expect(result.recentActivities).toEqual([]);
        expect(result.recentReports).toEqual([]);
        expect(result.summary.hasActivities).toBe(false);
        expect(result.needsInitialSync).toBe(true);
        expect(result.garminEmail).toBeNull();
    });
});
