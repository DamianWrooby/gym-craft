import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    db: {
        plan: { findFirst: vi.fn() },
        athleteProfile: { findUnique: vi.fn(async () => ({ timezone: 'UTC' })) },
        activity: { findMany: vi.fn(), findUnique: vi.fn() },
        plannedSession: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(async () => null),
            update: vi.fn(),
            updateMany: vi.fn(async () => ({ count: 1 })),
        },
    },
}));

vi.mock('$lib/database', () => ({ db: mocks.db }));

import { linkSession, linkSyncedActivities, unlinkSession } from './link';

const week = { id: 'w1', startDate: new Date('2026-10-19'), endDate: new Date('2026-10-25') };
const run = {
    id: 'a1',
    activityType: 'running',
    startTime: new Date('2026-10-20T07:00:00Z'),
    durationSec: 3600,
    trimpLoad: 60,
};
const plannedRun = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    userId: 'u1',
    kind: 'RUNNING',
    scheduledDate: new Date('2026-10-20'),
    status: 'PLANNED',
    plannedLoad: 60,
    activityId: null,
    body: { steps: [{ label: 'E', durationSec: 3600 }] },
    ...over,
});

function givenSync(sessions: unknown[], activities: unknown[] = [run], linked: unknown[] = []) {
    mocks.db.plan.findFirst.mockResolvedValue({ phases: [{ weeks: [week] }] });
    mocks.db.activity.findMany.mockResolvedValue(activities);
    mocks.db.plannedSession.findMany.mockResolvedValueOnce(linked).mockResolvedValueOnce(sessions);
}

afterEach(() => vi.clearAllMocks());

describe('linkSyncedActivities', () => {
    it('links a matched activity and sets the session DONE', async () => {
        givenSync([plannedRun()]);
        const result = await linkSyncedActivities('u1', ['a1']);
        expect(mocks.db.plannedSession.updateMany).toHaveBeenCalledWith({
            where: { id: 's1', activityId: null },
            data: { activityId: 'a1', status: 'DONE' },
        });
        expect(result.unscheduled).toEqual([]);
    });

    it('lets late evidence flip a skipped session to DONE (story 67)', async () => {
        givenSync([plannedRun({ status: 'SKIPPED' })]);
        await linkSyncedActivities('u1', ['a1']);
        expect(mocks.db.plannedSession.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ data: { activityId: 'a1', status: 'DONE' } }),
        );
    });

    it('reads only open sessions of the activity week', async () => {
        givenSync([plannedRun()]);
        await linkSyncedActivities('u1', ['a1']);
        expect(mocks.db.plannedSession.findMany).toHaveBeenLastCalledWith({
            where: { userId: 'u1', planWeekId: 'w1', activityId: null, status: { not: 'SUPERSEDED' } },
            orderBy: [{ scheduledDate: 'asc' }, { sequence: 'asc' }],
        });
    });

    it('reports an activity with no session as unscheduled', async () => {
        givenSync([]);
        expect(await linkSyncedActivities('u1', ['a1'])).toEqual({ unscheduled: ['a1'] });
        expect(mocks.db.plannedSession.updateMany).not.toHaveBeenCalled();
    });

    it('skips an activity already linked to a session', async () => {
        givenSync([plannedRun()], [run], [{ activityId: 'a1' }]);
        await linkSyncedActivities('u1', ['a1']);
        expect(mocks.db.plannedSession.updateMany).not.toHaveBeenCalled();
    });

    it('ignores activities outside the plan', async () => {
        givenSync([plannedRun()], [{ ...run, startTime: new Date('2026-11-20T07:00:00Z') }]);
        expect(await linkSyncedActivities('u1', ['a1'])).toEqual({ unscheduled: [] });
    });

    it('does nothing without an active plan', async () => {
        mocks.db.plan.findFirst.mockResolvedValue(null);
        expect(await linkSyncedActivities('u1', ['a1'])).toEqual({ unscheduled: [] });
        expect(mocks.db.activity.findMany).not.toHaveBeenCalled();
    });
});

describe('unlinkSession / linkSession', () => {
    const today = '2026-10-21';
    const stored = (over: Record<string, unknown> = {}) => ({
        ...plannedRun(over),
        planWeek: { startDate: week.startDate, endDate: week.endDate },
    });

    it('unlinks a linked session in the current week and reopens it', async () => {
        mocks.db.plannedSession.findUnique.mockResolvedValue(stored({ activityId: 'a1', status: 'DONE' }));
        expect(await unlinkSession('u1', 's1', today)).toEqual({ kind: 'saved', sessionId: 's1' });
        expect(mocks.db.plannedSession.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { activityId: null, status: 'PLANNED' },
        });
    });

    it('refuses to unlink outside the current week', async () => {
        mocks.db.plannedSession.findUnique.mockResolvedValue(stored({ activityId: 'a1' }));
        expect(await unlinkSession('u1', 's1', '2026-10-27')).toMatchObject({ kind: 'locked' });
    });

    it('relinks a session to a same-kind activity from the week', async () => {
        mocks.db.plannedSession.findUnique.mockResolvedValue(stored());
        mocks.db.activity.findUnique.mockResolvedValue({ userId: 'u1', ...run });
        expect(await linkSession('u1', 's1', 'a1', today)).toEqual({ kind: 'saved', sessionId: 's1' });
        expect(mocks.db.plannedSession.updateMany).toHaveBeenCalledWith({
            where: { id: 's1', activityId: null },
            data: { activityId: 'a1', status: 'DONE' },
        });
    });

    it.each([
        { name: 'another kind', activity: { ...run, activityType: 'strength_training' } },
        { name: 'another week', activity: { ...run, startTime: new Date('2026-10-27T07:00:00Z') } },
    ])('refuses an activity of $name', async ({ activity }) => {
        mocks.db.plannedSession.findUnique.mockResolvedValue(stored());
        mocks.db.activity.findUnique.mockResolvedValue({ userId: 'u1', ...activity });
        expect(await linkSession('u1', 's1', 'a1', today)).toMatchObject({ kind: 'locked' });
    });

    it('refuses an activity linked elsewhere', async () => {
        mocks.db.plannedSession.findUnique.mockResolvedValue(stored());
        mocks.db.activity.findUnique.mockResolvedValue({ userId: 'u1', ...run });
        mocks.db.plannedSession.findFirst.mockResolvedValueOnce({ id: 's2' } as never);
        expect(await linkSession('u1', 's1', 'a1', today)).toMatchObject({ kind: 'locked' });
    });

    it("hides another athlete's activity", async () => {
        mocks.db.plannedSession.findUnique.mockResolvedValue(stored());
        mocks.db.activity.findUnique.mockResolvedValue({ userId: 'u2', ...run });
        expect(await linkSession('u1', 's1', 'a1', today)).toEqual({ kind: 'not-found' });
    });
});
