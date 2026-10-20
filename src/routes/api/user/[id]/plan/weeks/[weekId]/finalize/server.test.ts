import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const prismaMocks = vi.hoisted(() => ({ getAthleteProfile: vi.fn() }));
vi.mock('$lib/prisma/prisma', () => prismaMocks);

const tx = vi.hoisted(() => ({
    planWeek: { updateMany: vi.fn(), update: vi.fn() },
    plannedSession: { createMany: vi.fn() },
    aiUsage: { upsert: vi.fn() },
    aiRequest: { update: vi.fn() },
}));
const db = vi.hoisted(() => ({
    $transaction: vi.fn(),
    planWeek: { findUnique: vi.fn() },
    raceResult: { findMany: vi.fn() },
    activity: { findMany: vi.fn() },
    runningGoal: { findMany: vi.fn() },
}));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';
import { zonesFromMaxHr } from '$lib/planner/core/zones';

const userId = 'user-1';
const locals = { user: { id: userId, subscriptionTier: 'FREE' } } as unknown as App.Locals;

const validOutput = JSON.stringify({
    sessions: [
        {
            kind: 'STRENGTH',
            date: '2026-10-12',
            title: 'Lift',
            template: 'light-maintenance',
            durationMin: 40,
            exercises: [{ name: 'Squat', sets: 3, reps: '8', load: 'RPE 7' }],
        },
        {
            kind: 'RUNNING',
            date: '2026-10-14',
            title: 'Hard',
            keySession: 'hard',
            steps: [
                { label: 'z1', durationSec: 900 },
                {
                    repeat: 4,
                    steps: [
                        { label: 'z3', durationSec: 240 },
                        { label: 'z1', durationSec: 120 },
                    ],
                },
            ],
        },
        {
            kind: 'RUNNING',
            date: '2026-10-18',
            title: 'Long run',
            keySession: 'long',
            steps: [{ label: 'z1', durationSec: 5400 }],
        },
    ],
});

function week(overrides: Record<string, unknown> = {}, request: Record<string, unknown> = {}) {
    return {
        id: 'week-1',
        userId,
        startDate: new Date('2026-10-12T00:00:00Z'),
        endDate: new Date('2026-10-18T00:00:00Z'),
        generation: 'PENDING',
        aiRequest: {
            id: 'request-1',
            status: 'DONE',
            output: validOutput,
            retryCount: 0,
            input: { anchor: null },
            updatedAt: new Date('2026-10-12T08:59:00Z'),
            ...request,
        },
        phase: {
            school: 'POLARIZED',
            plan: {
                startDate: new Date('2026-10-12T00:00:00Z'),
                endDate: new Date('2027-01-31T00:00:00Z'),
                availability: { mon: true, tue: false, wed: true, thu: false, fri: true, sat: false, sun: true },
                longRunDay: 6,
                goal: { targetDistanceM: 21097 },
            },
        },
        ...overrides,
    };
}

function post(id = userId) {
    const request = new Request('http://test', { method: 'POST' });
    return POST({ request, params: { id, weekId: 'week-1' }, locals });
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T09:00:00Z'));
    prismaMocks.getAthleteProfile.mockResolvedValue({ userId, timezone: 'UTC', hrZoneBounds: zonesFromMaxHr(190) });
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    db.planWeek.findUnique.mockResolvedValue(week());
    db.raceResult.findMany.mockResolvedValue([]);
    db.activity.findMany.mockResolvedValue([]);
    db.runningGoal.findMany.mockResolvedValue([]);
    tx.planWeek.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/plan/weeks/[weekId]/finalize', () => {
    it('returns 403 for another user', async () => {
        expect((await post('someone-else')).status).toBe(403);
    });

    it('returns 404 for a week the athlete does not own', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(week({ userId: 'someone-else' }));
        expect((await post()).status).toBe(404);
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('stores costed sessions, marks the week generated and logs a plan pull', async () => {
        const response = await post();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: { generation: 'GENERATED' } });

        expect(tx.planWeek.updateMany).toHaveBeenCalledWith({
            where: { id: 'week-1', generation: { not: 'GENERATED' } },
            data: { generation: 'GENERATED' },
        });
        const rows = tx.plannedSession.createMany.mock.calls[0][0].data;
        expect(rows).toHaveLength(3);
        expect(rows[0]).toMatchObject({
            userId,
            planWeekId: 'week-1',
            kind: 'STRENGTH',
            origin: 'AI',
            plannedLoad: 80,
            loadMethod: 'DURATION',
        });
        // 15 min z1 ×2 + 4 × (4 min z3 ×4.5 + 2 min z1 ×2) = 30 + 88
        expect(rows[1]).toMatchObject({ kind: 'RUNNING', plannedLoad: 118, loadMethod: 'LABEL_TABLE' });
        expect(rows[1].body.steps[0].target).toMatchObject({ type: 'HR' });
        expect(tx.aiUsage.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ create: expect.objectContaining({ kind: 'plan_pull', day: '2026-10-01' }) }),
        );
    });

    it('is idempotent: a generated week is not written twice', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(week({ generation: 'GENERATED' }));
        const response = await post();
        expect(await response.json()).toEqual({ data: { generation: 'GENERATED' } });
        expect(tx.plannedSession.createMany).not.toHaveBeenCalled();
    });

    it('writes nothing when a concurrent finalize won the race', async () => {
        tx.planWeek.updateMany.mockResolvedValueOnce({ count: 0 });
        expect((await post()).status).toBe(200);
        expect(tx.plannedSession.createMany).not.toHaveBeenCalled();
        expect(tx.aiUsage.upsert).not.toHaveBeenCalled();
    });

    it('answers 202 while the AI request is still running', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(week({}, { status: 'RUNNING', output: null }));
        const response = await post();
        expect(response.status).toBe(202);
        expect(await response.json()).toEqual({ data: { generation: 'PENDING', requestStatus: 'RUNNING' } });
    });

    it('fails the week and the request when the output is rejected', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(week({}, { output: '{"sessions":[{"kind":"OTHER"}]}' }));
        const response = await post();
        expect(await response.json()).toEqual({ data: { generation: 'FAILED', retriesLeft: 2 } });
        expect(tx.aiRequest.update).toHaveBeenCalledWith({
            where: { id: 'request-1' },
            data: { status: 'FAILED', error: expect.stringContaining('Session 1') },
        });
        expect(tx.planWeek.update).toHaveBeenCalledWith({ where: { id: 'week-1' }, data: { generation: 'FAILED' } });
        expect(tx.plannedSession.createMany).not.toHaveBeenCalled();
    });

    it('costs and targets from the anchor the prompt was built with, not a newer one', async () => {
        const anchor = {
            provenance: 'RACE_RESULT',
            sourceId: 'r1',
            date: '2026-01-10',
            distanceM: 5000,
            timeSec: 1200,
            stale: true,
        };
        db.planWeek.findUnique.mockResolvedValueOnce(week({}, { input: { anchor } }));
        db.raceResult.findMany.mockResolvedValue([
            { id: 'r2', date: new Date('2026-10-01T00:00:00Z'), distanceM: 5000, timeSec: 1500 },
        ]);
        await post();
        const rows = tx.plannedSession.createMany.mock.calls[0][0].data;
        expect(rows[1].anchor).toEqual({ provenance: 'RACE_RESULT', sourceId: 'r1', date: '2026-01-10', stale: true });
    });

    it('fails a request the proxy left RUNNING for more than five minutes, so it can be retried', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(
            week({}, { status: 'RUNNING', output: null, updatedAt: new Date('2026-10-12T08:50:00Z') }),
        );
        expect(await (await post()).json()).toEqual({ data: { generation: 'FAILED', retriesLeft: 2 } });
        expect(tx.aiRequest.update).toHaveBeenCalledWith({
            where: { id: 'request-1' },
            data: { status: 'FAILED', error: expect.stringMatching(/stalled/i) },
        });
    });

    it('fails the week when the proxy failed the request', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(week({}, { status: 'FAILED', output: null, retryCount: 1 }));
        expect(await (await post()).json()).toEqual({ data: { generation: 'FAILED', retriesLeft: 1 } });
        expect(tx.planWeek.update).toHaveBeenCalledWith({ where: { id: 'week-1' }, data: { generation: 'FAILED' } });
    });

    describe('school versus budget', () => {
        // The valid week costs 378: lift 80, hard 118, long 180.
        const foundation = {
            kind: 'RUNNING',
            date: '2026-10-16',
            title: 'Foundation run',
            cutKey: 'foundation',
            steps: [{ label: 'z1', durationSec: 1200 }],
        };
        const withFoundation = JSON.stringify({ sessions: [...JSON.parse(validOutput).sessions, foundation] });

        it('stores the week as written when it is within the budget', async () => {
            db.planWeek.findUnique.mockResolvedValueOnce(week({ recoveryBudget: 400 }));
            await post();
            expect(tx.plannedSession.createMany.mock.calls[0][0].data).toHaveLength(3);
            expect(tx.planWeek.updateMany.mock.calls[0][0].data).toEqual({ generation: 'GENERATED' });
        });

        it('trims easy volume silently in cut order and records the four facts', async () => {
            db.planWeek.findUnique.mockResolvedValueOnce(week({ recoveryBudget: 390 }, { output: withFoundation }));
            await post();
            const rows = tx.plannedSession.createMany.mock.calls[0][0].data;
            expect(rows.map((r: { body: { title: string } }) => r.body.title)).toEqual(['Lift', 'Hard', 'Long run']);
            expect(tx.planWeek.updateMany.mock.calls[0][0].data).toEqual({
                generation: 'GENERATED',
                conflict: {
                    placement: null,
                    budget: {
                        kind: 'TRIM',
                        facts: expect.objectContaining({
                            plannedTotal: 418,
                            budget: 390,
                            overspend: 28,
                            removed: [{ title: 'Foundation run', plannedLoad: 40, cutKey: 'foundation' }],
                            cutOrder: ['recovery', 'foundation'],
                            protected: ['Hard', 'Long run'],
                        }),
                    },
                },
            });
        });

        it('stores the week as written and asks before a key session goes', async () => {
            db.planWeek.findUnique.mockResolvedValueOnce(week({ recoveryBudget: 300 }));
            await post();
            expect(tx.plannedSession.createMany.mock.calls[0][0].data).toHaveLength(3);
            const { data } = tx.planWeek.updateMany.mock.calls[0][0];
            expect(data.decision).toBe('PENDING');
            expect(data.conflict.budget).toMatchObject({
                kind: 'ASK',
                schoolFit: false,
                removed: [],
                keySession: { scheduledDate: '2026-10-14', sequence: 0 },
                facts: { offered: { title: 'Hard', options: ['DROP', 'DOWNGRADE', 'KEEP'] } },
            });
        });

        it('raises a school-fit warning when key sessions alone exceed the budget', async () => {
            db.planWeek.findUnique.mockResolvedValueOnce(week({ recoveryBudget: 250 }));
            await post();
            expect(tx.planWeek.updateMany.mock.calls[0][0].data.conflict.budget.schoolFit).toBe(true);
        });
    });
});
