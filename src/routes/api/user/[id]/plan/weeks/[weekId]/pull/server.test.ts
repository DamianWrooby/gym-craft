import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const prismaMocks = vi.hoisted(() => ({ getAthleteProfile: vi.fn() }));
vi.mock('$lib/prisma/prisma', () => prismaMocks);

const tx = vi.hoisted(() => ({
    aiRequest: { create: vi.fn() },
    planWeek: { updateMany: vi.fn() },
    plannedSession: { updateMany: vi.fn() },
}));
const db = vi.hoisted(() => ({
    $transaction: vi.fn(),
    plan: { findFirst: vi.fn() },
    raceResult: { findMany: vi.fn() },
    activity: { findMany: vi.fn(), findFirst: vi.fn() },
    garminData: { findUnique: vi.fn() },
    runningGoal: { findMany: vi.fn() },
}));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId, subscriptionTier: 'FREE' } } as unknown as App.Locals;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

function week(id: string, start: string, end: string, aiRequestId: string | null, sessions: unknown[] = []) {
    return {
        id,
        startDate: d(start),
        endDate: d(end),
        inHorizonDays: 7,
        isCutback: false,
        isTaper: false,
        timeTrialDistanceM: null,
        volumeTarget: 240,
        volumeUnit: 'MINUTES',
        strengthSessionTarget: 2,
        aiRequestId,
        sessions,
    };
}

function activePlan(week2Request: string | null = null) {
    return {
        id: 'plan-1',
        startDate: d('2026-10-12'),
        endDate: d('2027-01-31'),
        availability: { mon: true, tue: false, wed: true, thu: false, fri: true, sat: false, sun: true },
        longRunDay: 6,
        goal: { targetDistanceM: 21097 },
        phases: [
            {
                name: 'Base',
                intent: 'Build aerobic volume',
                source: 'SCHOOL',
                school: 'POLARIZED',
                weeks: [
                    week('week-1', '2026-10-12', '2026-10-18', 'request-1', [
                        { id: 'past', status: 'PLANNED', scheduledDate: d('2026-10-13') },
                    ]),
                    week('week-2', '2026-10-19', '2026-10-25', week2Request),
                ],
            },
        ],
    };
}

function post(body: unknown, weekId = 'week-2', id = userId) {
    const request = new Request('http://test', { method: 'POST', body: JSON.stringify(body) });
    return POST({ request, params: { id, weekId }, locals });
}

const validBody = { outlook: 'BUSY', confirmations: [{ sessionId: 'past', status: 'SKIPPED' }] };

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T09:00:00Z'));
    prismaMocks.getAthleteProfile.mockResolvedValue({ userId, timezone: 'UTC' });
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    db.plan.findFirst.mockResolvedValue(activePlan());
    db.raceResult.findMany.mockResolvedValue([]);
    db.activity.findMany.mockResolvedValue([]);
    db.activity.findFirst.mockResolvedValue(null);
    db.garminData.findUnique.mockResolvedValue(null);
    db.runningGoal.findMany.mockResolvedValue([]);
    tx.aiRequest.create.mockResolvedValue({ id: 'request-2' });
    tx.planWeek.updateMany.mockResolvedValue({ count: 1 });
    tx.plannedSession.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/plan/weeks/[weekId]/pull', () => {
    it('returns 403 for another user', async () => {
        expect((await post(validBody, 'week-2', 'someone-else')).status).toBe(403);
    });

    it('rejects an unknown outlook', async () => {
        expect((await post({ outlook: 'TIRED', confirmations: [] })).status).toBe(400);
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('writes one AI request for next week with the outlook, and confirms past sessions', async () => {
        const response = await post(validBody);
        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ data: { weekId: 'week-2', aiRequestId: 'request-2' } });

        expect(tx.aiRequest.create).toHaveBeenCalledTimes(1);
        const input = tx.aiRequest.create.mock.calls[0][0].data.input;
        expect(input.user).toContain('2026-10-19');
        expect(input.user).toContain('busy');
        expect(tx.planWeek.updateMany).toHaveBeenCalledWith({
            where: { id: 'week-2', userId, aiRequestId: null },
            data: expect.objectContaining({ aiRequestId: 'request-2', outlook: 'BUSY', outlookFactor: 0.85 }),
        });
        expect(tx.plannedSession.updateMany).toHaveBeenCalledWith({
            where: { id: 'past', userId, status: 'PLANNED', scheduledDate: { lt: d('2026-10-14') } },
            data: { status: 'SKIPPED' },
        });
    });

    it('answers 409 when the week already has its request', async () => {
        db.plan.findFirst.mockResolvedValueOnce(activePlan('request-x'));
        const response = await post(validBody);
        expect(response.status).toBe(409);
        expect(tx.aiRequest.create).not.toHaveBeenCalled();
    });

    it('rolls back when a concurrent pull claimed the week first', async () => {
        tx.planWeek.updateMany.mockResolvedValueOnce({ count: 0 });
        db.$transaction.mockImplementationOnce(async (fn: (t: typeof tx) => unknown) => fn(tx));
        const response = await post(validBody);
        expect(response.status).toBe(409);
    });

    it('refuses a week that is not the one to pull today', async () => {
        const response = await post(validBody, 'week-1');
        expect(response.status).toBe(409);
        expect(tx.aiRequest.create).not.toHaveBeenCalled();
    });

    it('re-derives the anchor at the pull from the latest race results', async () => {
        db.raceResult.findMany.mockResolvedValueOnce([
            { id: 'r1', date: d('2026-10-13'), distanceM: 10000, timeSec: 2700 },
        ]);
        await post(validBody);
        const input = tx.aiRequest.create.mock.calls[0][0].data.input;
        expect(input.anchor).toMatchObject({ provenance: 'RACE_RESULT', sourceId: 'r1' });
    });

    it('strikes the budget once at the pull, sized by the outlook, and freezes it on the week', async () => {
        db.activity.findFirst.mockResolvedValue({ startTime: new Date('2026-06-01T07:00:00Z') });
        // 28 days of 50 TRIMP: chronic load 50, one lift costed at the flat rate.
        db.activity.findMany.mockResolvedValue(
            Array.from({ length: 28 }, (_, i) => ({
                startTime: new Date(Date.UTC(2026, 8, 17 + i, 7)),
                trimpLoad: 50,
                loadMethod: i === 0 ? 'DURATION' : 'EDWARDS',
            })),
        );
        await post(validBody);
        expect(tx.planWeek.updateMany.mock.calls[0][0].data).toMatchObject({
            chronicLoad: 50,
            recoveryBudget: 386.8,
            chronicFallbackShare: 0.04,
            budgetAbsence: null,
            budgetStruckAt: expect.any(Date),
        });
    });

    it('locks the budget for an athlete without a Garmin link, and says why', async () => {
        await post(validBody);
        expect(tx.planWeek.updateMany.mock.calls[0][0].data).toMatchObject({
            recoveryBudget: null,
            chronicLoad: null,
            budgetAbsence: 'NO_TRACKED_ACTIVITY',
        });
    });

    it('strikes no budget under 28 days of history', async () => {
        db.garminData.findUnique.mockResolvedValue({ id: 'g1' });
        db.activity.findFirst.mockResolvedValue({ startTime: new Date('2026-10-01T07:00:00Z') });
        db.activity.findMany.mockResolvedValue([
            { startTime: new Date('2026-10-01T07:00:00Z'), trimpLoad: 80, loadMethod: 'EDWARDS' },
        ]);
        await post(validBody);
        expect(tx.planWeek.updateMany.mock.calls[0][0].data).toMatchObject({
            recoveryBudget: null,
            budgetAbsence: 'SHORT_HISTORY',
        });
    });
});
