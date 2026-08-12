import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    db: {
        activity: { findMany: vi.fn(), aggregate: vi.fn(), update: vi.fn() },
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

/** Only the columns the narrowed selects actually ask for. */
function activityRow(id: string, startTime: string, trimpLoad: number | null = 40) {
    return {
        id,
        garminActivityId: BigInt(id.replace(/\D/g, '') || '1'),
        activityType: 'running',
        activityName: `Run ${id}`,
        startTime: new Date(startTime),
        durationSec: 1800,
        distanceM: 5000,
        calories: 350,
        averageHr: 145,
        averageSpeed: 2.78,
        elevationGainM: 25,
        hrZone1Sec: null,
        hrZone2Sec: null,
        hrZone3Sec: null,
        hrZone4Sec: null,
        hrZone5Sec: null,
        trimpLoad,
    };
}

/**
 * The load issues two findMany calls: the recent-activities list (awaited) and the
 * summary window (streamed). They run concurrently, so resolve by call order.
 */
function mockActivityQueries(recent: ReturnType<typeof activityRow>[], window = recent, earliest?: Date) {
    mocks.db.activity.findMany.mockImplementation(async (args: { take?: number }) => (args.take ? recent : window));
    mocks.db.activity.aggregate.mockResolvedValue({
        _min: { startTime: earliest ?? window.at(-1)?.startTime ?? null },
    });
}

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

describe('load /app/running/analytics (dashboard)', () => {
    it('redirects to /app/login when there is no session user', async () => {
        const noLocals = { user: undefined } as unknown as App.Locals;
        await expect(load({ locals: noLocals })).rejects.toMatchObject({ status: 302 });
    });

    it('returns at most 5 recent activities and 3 recent reports', async () => {
        const rows = Array.from({ length: 5 }, (_, i) => activityRow(`a-${i}`, `2026-06-0${(i % 7) + 1}T07:00:00Z`));
        mockActivityQueries(rows);
        mocks.db.garminSyncState.findUnique.mockResolvedValue({
            lastSyncedAt: new Date('2026-06-07T11:00:00Z'),
            backfillComplete: true,
        });
        mocks.db.garminData.findUnique.mockResolvedValue({ email: 'athlete@example.com', sessionToken: null });
        mocks.db.athleteProfile.findUnique.mockResolvedValue({ restingHR: 50, maxHR: 190, sex: 'MALE' });
        mocks.getWeeklyReports.mockResolvedValue(
            ['r-1', 'r-2', 'r-3', 'r-4'].map((id) => ({
                id,
                periodStart: '2026-06-01',
                periodEnd: '2026-06-07',
                summary: id.toUpperCase(),
                createdAt: new Date('2026-06-08T00:00:00Z'),
            })),
        );

        const result = await load({ locals });

        expect(result.recentActivities).toHaveLength(5);
        expect(result.needsInitialSync).toBe(false);
        expect(result.garminEmail).toBe('athlete@example.com');
        expect(result.lastSyncedAt).toBe('2026-06-07T11:00:00.000Z');

        const reports = await result.recentReports;
        expect(reports).toHaveLength(3);
        expect(reports[0].id).toBe('r-1');

        const summary = await result.summary;
        expect(summary.hasActivities).toBe(true);
    });

    it('bounds the summary query to a rolling window and never selects the raw payload', async () => {
        mockActivityQueries([activityRow('a-1', '2026-06-06T07:00:00Z')]);
        mocks.db.garminSyncState.findUnique.mockResolvedValue({ lastSyncedAt: new Date(), backfillComplete: true });
        mocks.db.garminData.findUnique.mockResolvedValue(null);
        mocks.db.athleteProfile.findUnique.mockResolvedValue(null);
        mocks.getWeeklyReports.mockResolvedValue([]);

        const result = await load({ locals });
        await result.summary;

        const calls = mocks.db.activity.findMany.mock.calls.map(([args]) => args);
        const windowCall = calls.find((c) => c.where.startTime != null);
        const recentCall = calls.find((c) => c.take != null);

        expect(windowCall.where.startTime.gte).toBeInstanceOf(Date);
        expect(recentCall.take).toBe(5);
        for (const call of calls) {
            expect(call.select).toBeDefined();
            expect(call.select.raw).toBeUndefined();
        }
    });

    it('excludes non-training activities from the load window and the history probe', async () => {
        mockActivityQueries([activityRow('a-1', '2026-06-06T07:00:00Z')]);
        mocks.db.garminSyncState.findUnique.mockResolvedValue({ lastSyncedAt: new Date(), backfillComplete: true });
        mocks.db.garminData.findUnique.mockResolvedValue(null);
        mocks.db.athleteProfile.findUnique.mockResolvedValue(null);
        mocks.getWeeklyReports.mockResolvedValue([]);

        const result = await load({ locals });
        await result.summary;

        const windowCall = mocks.db.activity.findMany.mock.calls
            .map(([args]) => args)
            .find((c) => c.where.startTime != null);
        // Auto-logged walks would pad the chronic baseline and depress ACWR.
        expect(windowCall.where.activityType).toEqual({ notIn: ['walking'] });
        expect(windowCall.select.activityType).toBe(true);

        // The _min probe must exclude them too: a two-year-old commute walk would otherwise
        // report a brand-new runner as having a mature chronic baseline.
        const [aggregateArgs] = mocks.db.activity.aggregate.mock.calls[0];
        expect(aggregateArgs.where.activityType).toEqual({ notIn: ['walking'] });
    });

    it('keeps non-training activities visible in the recent-activities list', async () => {
        mockActivityQueries([activityRow('a-1', '2026-06-06T07:00:00Z')]);
        mocks.db.garminSyncState.findUnique.mockResolvedValue({ lastSyncedAt: new Date(), backfillComplete: true });
        mocks.db.garminData.findUnique.mockResolvedValue(null);
        mocks.db.athleteProfile.findUnique.mockResolvedValue(null);
        mocks.getWeeklyReports.mockResolvedValue([]);

        await load({ locals });

        // Hiding a synced walk from the list would make the Garmin sync look broken.
        const recentCall = mocks.db.activity.findMany.mock.calls.map(([args]) => args).find((c) => c.take != null);
        expect(recentCall.where.activityType).toBeUndefined();
    });

    it('computes TRIMP in memory for legacy rows without persisting anything', async () => {
        const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
        // Legacy rows: synced before TRIMP was computed at write time.
        const rows = [
            activityRow('a-1', daysAgo(1), null),
            activityRow('a-2', daysAgo(3), null),
            activityRow('a-3', daysAgo(10), null),
            activityRow('a-4', daysAgo(20), null),
        ];
        mockActivityQueries(rows, rows, new Date(daysAgo(60)));
        mocks.db.garminSyncState.findUnique.mockResolvedValue({ lastSyncedAt: new Date(), backfillComplete: true });
        mocks.db.garminData.findUnique.mockResolvedValue({ email: 'a@b.c', sessionToken: null });
        mocks.db.athleteProfile.findUnique.mockResolvedValue({ restingHR: 50, maxHR: 190, sex: 'MALE' });
        mocks.getWeeklyReports.mockResolvedValue([]);

        const result = await load({ locals });
        const summary = await result.summary;

        expect(summary.acwr).toBeGreaterThan(0);
        // A page GET must not issue writes.
        expect(mocks.db.$transaction).not.toHaveBeenCalled();
        expect(mocks.db.activity.update).not.toHaveBeenCalled();
    });

    it('reports sufficient history from the earliest activity, not the oldest in the window', async () => {
        const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
        // Returning athlete: trained two years ago, paused, came back last week. Every
        // row inside the window is recent, so only the _min probe can get this right.
        const rows = [activityRow('a-1', daysAgo(2)), activityRow('a-2', daysAgo(5))];
        mockActivityQueries(rows, rows, new Date(daysAgo(730)));
        mocks.db.garminSyncState.findUnique.mockResolvedValue({ lastSyncedAt: new Date(), backfillComplete: true });
        mocks.db.garminData.findUnique.mockResolvedValue(null);
        mocks.db.athleteProfile.findUnique.mockResolvedValue(null);
        mocks.getWeeklyReports.mockResolvedValue([]);

        const result = await load({ locals });
        const summary = await result.summary;

        expect(summary.hasSufficientHistory).toBe(true);
    });

    it('flags needsInitialSync and empty previews when there is no data', async () => {
        mockActivityQueries([], [], undefined);
        mocks.db.activity.aggregate.mockResolvedValue({ _min: { startTime: null } });
        mocks.db.garminSyncState.findUnique.mockResolvedValue(null);
        mocks.db.garminData.findUnique.mockResolvedValue(null);
        mocks.db.athleteProfile.findUnique.mockResolvedValue(null);
        mocks.getWeeklyReports.mockResolvedValue([]);

        const result = await load({ locals });

        expect(result.recentActivities).toEqual([]);
        expect(await result.recentReports).toEqual([]);
        expect((await result.summary).hasActivities).toBe(false);
        expect(result.needsInitialSync).toBe(true);
        expect(result.garminEmail).toBeNull();
    });
});
