import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    db: {
        activity: { findMany: vi.fn(), count: vi.fn() },
        garminSyncState: { findUnique: vi.fn() },
    },
}));

vi.mock('$lib/database', () => ({ db: mocks.db }));

import { load } from './+page.server';
import { activityListSelect } from '$lib/server/garmin/activity-row-mapper';
import { ACTIVITY_MAX_SHOWN, ACTIVITY_PAGE_SIZE } from '$lib/utils/activity-list-query';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

const url = (search = '') => new URL(`http://localhost/app/running/analytics/activities${search}`);

/** Only the columns `activityListSelect` asks for — which is all the query returns. */
const row = (id: string, startTime: string) => ({
    id,
    garminActivityId: BigInt(111),
    activityType: 'running',
    activityName: 'Run A',
    startTime: new Date(startTime),
    durationSec: 1800,
    distanceM: 5000,
    calories: 350,
    averageHr: 145,
    averageSpeed: 2.78,
    elevationGainM: 25,
    trimpLoad: 40,
});

const rows = (count: number) =>
    Array.from({ length: count }, (_, i) =>
        row(`a-${i}`, `2026-05-${String((i % 28) + 1).padStart(2, '0')}T07:00:00Z`),
    );

/** `total` drives hasMore, so it is passed separately from the page of rows returned. */
function mockDb({ returned, total, lastSyncedAt }: { returned: number; total: number; lastSyncedAt?: Date | null }) {
    mocks.db.activity.findMany.mockResolvedValueOnce(rows(returned));
    mocks.db.activity.count.mockResolvedValueOnce(total);
    mocks.db.garminSyncState.findUnique.mockResolvedValueOnce(
        lastSyncedAt === undefined || lastSyncedAt === null ? null : { userId, lastSyncedAt },
    );
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T14:30:00.000Z'));
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('load /app/running/analytics/activities', () => {
    it('redirects to /app/login when there is no session user', async () => {
        const noLocals = { user: undefined } as unknown as App.Locals;
        await expect(load({ locals: noLocals, url: url() })).rejects.toMatchObject({ status: 302 });
    });

    it('bounds the read to one page inside the default 90-day window', async () => {
        mockDb({ returned: ACTIVITY_PAGE_SIZE, total: 143 });

        const result = await load({ locals, url: url() });

        expect(mocks.db.activity.findMany).toHaveBeenCalledWith({
            where: {
                userId,
                startTime: {
                    gte: new Date('2026-05-11T00:00:00.000Z'),
                    lte: new Date('2026-08-08T23:59:59.999Z'),
                },
            },
            orderBy: { startTime: 'desc' },
            select: activityListSelect,
            take: ACTIVITY_PAGE_SIZE,
        });
        // The row count is now bounded, not just the column list: an unbounded findMany was
        // the whole defect. `raw` (the full Garmin payload per row) stays unselected.
        expect(activityListSelect).not.toHaveProperty('raw');
        expect(result.activities).toHaveLength(ACTIVITY_PAGE_SIZE);
        expect(result).toMatchObject({ from: '2026-05-11', to: '2026-08-08', shown: ACTIVITY_PAGE_SIZE, total: 143 });
    });

    it('counts against the same window it reads from', async () => {
        mockDb({ returned: 5, total: 5 });

        await load({ locals, url: url('?from=2026-01-01&to=2026-02-15') });

        const where = {
            userId,
            startTime: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-02-15T23:59:59.999Z') },
        };
        expect(mocks.db.activity.count).toHaveBeenCalledWith({ where });
        expect(mocks.db.activity.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    });

    it('takes the requested number of revealed rows', async () => {
        mockDb({ returned: 60, total: 143 });

        const result = await load({ locals, url: url('?from=2026-05-11&to=2026-08-08&shown=60') });

        expect(mocks.db.activity.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 60 }));
        expect(result.shown).toBe(60);
    });

    it('maps rows to list items with a serialisable garminActivityId', async () => {
        mockDb({ returned: 1, total: 1, lastSyncedAt: new Date('2026-05-21T11:00:00Z') });

        const result = await load({ locals, url: url() });

        expect(result.activities[0]).toMatchObject({ id: 'a-0', garminActivityId: '111' });
        expect(result.lastSyncedAt).toBe('2026-05-21T11:00:00.000Z');
    });

    it('reports hasMore when the window holds more rows than were read', async () => {
        mockDb({ returned: ACTIVITY_PAGE_SIZE, total: 143 });

        const result = await load({ locals, url: url() });

        expect(result.hasMore).toBe(true);
        expect(result.atMaxShown).toBe(false);
    });

    it('reports no more rows once the page holds the whole window', async () => {
        mockDb({ returned: 12, total: 12 });

        const result = await load({ locals, url: url() });

        expect(result.hasMore).toBe(false);
        expect(result.atMaxShown).toBe(false);
    });

    it('flags atMaxShown when rows remain but the ceiling is reached', async () => {
        mockDb({ returned: ACTIVITY_MAX_SHOWN, total: ACTIVITY_MAX_SHOWN + 1 });

        const result = await load({ locals, url: url(`?shown=${ACTIVITY_MAX_SHOWN}`) });

        expect(result.hasMore).toBe(true);
        expect(result.atMaxShown).toBe(true);
    });

    it('does not flag atMaxShown at the ceiling when nothing remains', async () => {
        mockDb({ returned: ACTIVITY_MAX_SHOWN, total: ACTIVITY_MAX_SHOWN });

        const result = await load({ locals, url: url(`?shown=${ACTIVITY_MAX_SHOWN}`) });

        expect(result.hasMore).toBe(false);
        expect(result.atMaxShown).toBe(false);
    });

    it('returns an empty list and a null lastSyncedAt when there is nothing in range', async () => {
        mockDb({ returned: 0, total: 0, lastSyncedAt: null });

        const result = await load({ locals, url: url() });

        expect(result.activities).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.hasMore).toBe(false);
        expect(result.lastSyncedAt).toBeNull();
    });
});
