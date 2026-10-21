import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const tx = vi.hoisted(() => ({
    aiRequest: { create: vi.fn(), delete: vi.fn() },
    planWeek: { updateMany: vi.fn() },
}));
const db = vi.hoisted(() => ({
    $transaction: vi.fn(),
    athleteProfile: { findUnique: vi.fn() },
    plan: { findFirst: vi.fn() },
    activity: { findMany: vi.fn() },
    plannedSession: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    aiUsage: { findUnique: vi.fn() },
    runningGoal: { findMany: vi.fn() },
    planWeek: { update: vi.fn() },
}));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId, subscriptionTier: 'FREE' } } as unknown as App.Locals;
const day = (d: string) => new Date(`${d}T00:00:00Z`);

const session = (id: string, date: string, over: Record<string, unknown> = {}) => ({
    id,
    kind: 'RUNNING',
    origin: 'AI',
    status: 'PLANNED',
    scheduledDate: day(date),
    sequence: 0,
    plannedLoad: 40,
    activityId: null,
    body: { title: id, keySession: null },
    ...over,
});

function activePlan(weekOver: Record<string, unknown> = {}) {
    return {
        id: 'plan-1',
        goalId: 'goal-1',
        endDate: day('2027-01-31'),
        availability: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
        longRunDay: 6,
        phases: [
            {
                name: 'Base',
                intent: 'Build',
                source: 'SCHOOL',
                school: 'POLARIZED',
                weeks: [
                    {
                        id: 'week-1',
                        startDate: day('2026-10-12'),
                        endDate: day('2026-10-18'),
                        generation: 'GENERATED',
                        recoveryBudget: 400,
                        revisedAt: null,
                        revisionGeneration: null,
                        revisionRequest: null,
                        aiRequest: { input: { anchor: null } },
                        isCutback: false,
                        isTaper: false,
                        volumeTarget: 180,
                        volumeUnit: 'MINUTES',
                        strengthSessionTarget: 2,
                        timeTrialDistanceM: null,
                        sessions: [session('mon', '2026-10-12', { status: 'DONE' }), session('thu', '2026-10-15')],
                        ...weekOver,
                    },
                ],
            },
        ],
    };
}

function post(body: unknown, id = userId) {
    const request = new Request('http://test', { method: 'POST', body: JSON.stringify(body) });
    return POST({ request, params: { id }, locals });
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T09:00:00Z'));
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    db.athleteProfile.findUnique.mockResolvedValue({ timezone: 'UTC' });
    db.plan.findFirst.mockResolvedValue(activePlan());
    db.activity.findMany.mockResolvedValue([]);
    db.plannedSession.findMany.mockResolvedValue([]);
    db.user.findUnique.mockResolvedValue({ subscriptionStatus: null, currentPeriodEnd: null, aiModelPreference: null });
    db.aiUsage.findUnique.mockResolvedValue({ count: 1 });
    db.runningGoal.findMany.mockResolvedValue([]);
    tx.aiRequest.create.mockResolvedValue({ id: 'request-9' });
    tx.planWeek.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/plan/revision', () => {
    it('returns 403 for another user', async () => {
        expect((await post({ trigger: 'ATHLETE' }, 'someone-else')).status).toBe(403);
    });

    it('rejects a trigger the athlete cannot send', async () => {
        expect((await post({ trigger: 'UNSCHEDULED' })).status).toBe(400);
    });

    it('writes one revision request on the FREE model, scoped to the rest of the week', async () => {
        const res = await post({ trigger: 'ATHLETE' });
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ kind: 'requested', weekId: 'week-1', aiRequestId: 'request-9' });
        expect(tx.aiRequest.create.mock.calls[0][0].data.model).toBe('gpt-5.4-mini');
        const update = tx.planWeek.updateMany.mock.calls[0][0].data;
        expect(update.revisionGeneration).toBe('PENDING');
        expect(update.revisionReason).toMatchObject({ outcome: 'revise', scope: ['thu'], from: '2026-10-14' });
        expect(update.revisionCause).toEqual({ trigger: 'ATHLETE' });
    });

    it('at the cap stores the verdict and writes no AI request', async () => {
        db.aiUsage.findUnique.mockResolvedValue({ count: 4 });
        const res = await post({ trigger: 'ATHLETE' });
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ kind: 'capped', used: 4, cap: 4 });
        expect(tx.aiRequest.create).not.toHaveBeenCalled();
        expect(db.planWeek.update.mock.calls[0][0].data.revisionReason).toMatchObject({ outcome: 'capped' });
    });

    it('a supporter gets 30 revisions and their chosen model', async () => {
        db.user.findUnique.mockResolvedValue({
            subscriptionStatus: 'active',
            currentPeriodEnd: new Date('2027-01-01'),
            aiModelPreference: 'gpt-5.4-mini',
        });
        db.aiUsage.findUnique.mockResolvedValue({ count: 29 });
        const res = await post({ trigger: 'ATHLETE' });
        expect((await res.json()).data.kind).toBe('requested');
        expect(tx.aiRequest.create.mock.calls[0][0].data.model).toBe('gpt-5.4-mini');
    });

    it('keeps one revision in flight per week', async () => {
        db.plan.findFirst.mockResolvedValue(
            activePlan({
                revisionGeneration: 'PENDING',
                revisionRequest: { status: 'PENDING', updatedAt: new Date() },
            }),
        );
        const res = await post({ trigger: 'ATHLETE' });
        expect(res.status).toBe(409);
        expect(tx.aiRequest.create).not.toHaveBeenCalled();
    });

    it('answers no change when nothing is left to rewrite', async () => {
        db.plan.findFirst.mockResolvedValue(
            activePlan({ sessions: [session('mon', '2026-10-12', { status: 'DONE' })] }),
        );
        const res = await post({ trigger: 'ATHLETE' });
        expect((await res.json()).data).toEqual({ kind: 'no-change' });
    });
});
