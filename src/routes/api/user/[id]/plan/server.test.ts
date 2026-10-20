import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const prismaMocks = vi.hoisted(() => ({
    getAthleteProfile: vi.fn(),
    invalidateAthleteProfile: vi.fn(),
}));
vi.mock('$lib/prisma/prisma', () => prismaMocks);

// The repository runs against a mocked Prisma client so the test sees the one transaction.
const tx = vi.hoisted(() => ({
    plan: { count: vi.fn(), create: vi.fn() },
    planWeek: { update: vi.fn() },
    aiRequest: { create: vi.fn() },
    athleteProfile: { findUnique: vi.fn(), update: vi.fn() },
    raceResult: { createMany: vi.fn() },
}));
const db = vi.hoisted(() => ({
    $transaction: vi.fn(),
    runningGoal: { findMany: vi.fn() },
    raceResult: { findMany: vi.fn() },
    activity: { findMany: vi.fn(), findFirst: vi.fn() },
    garminData: { findUnique: vi.fn() },
}));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';
import { zonesFromMaxHr } from '$lib/planner/core/zones';

const userId = 'user-1';
const locals = { user: { id: userId, subscriptionTier: 'FREE' } } as unknown as App.Locals;

const raceGoal = {
    id: 'goal-1',
    goalType: 'RACE',
    targetEventDate: new Date('2027-01-31T00:00:00Z'),
    targetDistanceM: 21097,
    archivedAt: null,
};

const validBody = {
    goalId: 'goal-1',
    schoolId: 'POLARIZED',
    hrZoneBounds: zonesFromMaxHr(190),
    raceResults: [{ date: '2026-09-01', distanceM: 5000, timeSec: 1300 }],
    availability: { mon: true, tue: false, wed: true, thu: false, fri: true, sat: false, sun: true },
    longRunDay: 6,
};

function post(body: unknown, id = userId) {
    const request = new Request(`http://test/api/user/${id}/plan`, { method: 'POST', body: JSON.stringify(body) });
    return POST({ request, params: { id }, locals });
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T09:00:00Z')); // Monday
    prismaMocks.getAthleteProfile.mockResolvedValue({ userId, timezone: 'UTC' });
    db.runningGoal.findMany.mockResolvedValue([raceGoal]);
    db.raceResult.findMany.mockResolvedValue([]);
    db.activity.findMany.mockResolvedValue([]);
    db.activity.findFirst.mockResolvedValue(null);
    db.garminData.findUnique.mockResolvedValue(null);
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    tx.plan.count.mockResolvedValue(0);
    tx.athleteProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
    tx.plan.create.mockResolvedValue({
        id: 'plan-1',
        phases: [{ weeks: [{ id: 'week-1' }, { id: 'week-2' }] }, { weeks: [{ id: 'week-15' }] }],
    });
    tx.aiRequest.create.mockResolvedValue({ id: 'request-1' });
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/plan', () => {
    it('returns 403 for another user', async () => {
        expect((await post(validBody, 'someone-else')).status).toBe(403);
    });

    it('writes plan, phases and weeks, zones and results in one transaction', async () => {
        const response = await post(validBody);
        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({
            data: { id: 'plan-1', weekId: 'week-1', aiRequestId: 'request-1' },
        });
        expect(db.$transaction).toHaveBeenCalledTimes(1);

        const data = tx.plan.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ userId, goalId: 'goal-1', longRunDay: 6 });
        expect(data.startDate.toISOString().slice(0, 10)).toBe('2026-10-12');
        expect(data.endDate.toISOString().slice(0, 10)).toBe('2027-01-31');
        const phases = data.phases.create;
        expect(phases.map((p: { name: string }) => p.name)).toEqual(['Aerobic', 'Taper']);
        const weeks = phases.flatMap((p: { weeks: { create: unknown[] } }) => p.weeks.create);
        expect(weeks).toHaveLength(16);
        expect(weeks[0]).toMatchObject({ userId, inHorizonDays: 7, volumeUnit: 'MINUTES', timeTrialDistanceM: null });
        expect(weeks.map((w: { isTaper: boolean }) => w.isTaper).slice(-3)).toEqual([false, true, true]);
        expect(data.rationale.sections.map((s: { key: string }) => s.key)).toEqual([
            'school',
            'horizon',
            'anchor',
            'volume',
            'recovery',
            'week',
        ]);
        expect(data.rationale.sections[2].lines[0]).toBe('Your paces come from your 5 km on 2026-09-01 in 21:40.');

        expect(tx.athleteProfile.update).toHaveBeenCalledWith({
            where: { userId },
            data: { hrZoneBounds: validBody.hrZoneBounds },
        });
        expect(tx.raceResult.createMany).toHaveBeenCalledWith({
            data: [expect.objectContaining({ userId, distanceM: 5000, timeSec: 1300 })],
        });
        expect(prismaMocks.invalidateAthleteProfile).toHaveBeenCalledWith(userId);
    });

    it('writes one AI request for week 1 in the same transaction, with the tier model', async () => {
        await post(validBody);
        expect(db.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.aiRequest.create).toHaveBeenCalledTimes(1);
        const { data } = tx.aiRequest.create.mock.calls[0][0];
        expect(data).toMatchObject({ userId, model: 'gpt-5.4-mini' });
        expect(data.input).toMatchObject({ system: expect.any(String), user: expect.stringContaining('2026-10-12') });
        expect(tx.planWeek.update).toHaveBeenCalledWith({
            where: { id: 'week-1' },
            data: expect.objectContaining({ aiRequestId: 'request-1' }),
        });
    });

    it("strikes week 1's recovery budget at creation, with no outlook", async () => {
        await post(validBody);
        expect(tx.planWeek.update.mock.calls[0][0].data).toMatchObject({
            outlookFactor: 1,
            recoveryBudget: null,
            budgetAbsence: 'NO_TRACKED_ACTIVITY',
            budgetStruckAt: expect.any(Date),
        });
    });

    it('refuses a second active plan with 409', async () => {
        tx.plan.count.mockResolvedValueOnce(1);
        const response = await post(validBody);
        expect(response.status).toBe(409);
        expect(tx.plan.create).not.toHaveBeenCalled();
    });

    it('maps a concurrent unique-index violation to 409', async () => {
        db.$transaction.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
        expect((await post(validBody)).status).toBe(409);
    });

    it('requires an athlete profile', async () => {
        prismaMocks.getAthleteProfile.mockResolvedValueOnce(null);
        const response = await post(validBody);
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ code: 'PROFILE_REQUIRED' });
    });

    it.each([
        ['missing zone confirmation', { hrZoneBounds: undefined }],
        ['unknown school', { schoolId: 'NORWEGIAN' }],
        ['race result outside 1500–42195 m', { raceResults: [{ date: '2026-09-01', distanceM: 800, timeSec: 120 }] }],
        ['long-run day not a training day', { longRunDay: 1 }],
    ])('returns 400 for %s', async (_, overrides) => {
        const response = await post({ ...validBody, ...overrides });
        expect(response.status).toBe(400);
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('returns 404 for a goal the athlete does not own', async () => {
        expect((await post({ ...validBody, goalId: 'other' })).status).toBe(404);
    });

    it('returns 422 with the reason when the horizon cannot be laid out', async () => {
        db.runningGoal.findMany.mockResolvedValueOnce([
            { ...raceGoal, targetEventDate: new Date('2026-11-15T00:00:00Z') },
        ]);
        const response = await post(validBody);
        expect(response.status).toBe(422);
        expect((await response.json()).message).toContain('needs at least 9 weeks');
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('stores the time trial on its week when no anchor exists', async () => {
        await post({ ...validBody, raceResults: [] });
        const weeks = tx.plan.create.mock.calls[0][0].data.phases.create.flatMap(
            (p: { weeks: { create: unknown[] } }) => p.weeks.create,
        );
        expect(weeks[0]).toMatchObject({ timeTrialDistanceM: 5000 });
        expect(weeks.filter((w: { timeTrialDistanceM: number | null }) => w.timeTrialDistanceM)).toHaveLength(1);
    });

    it('takes the end date from the body for an undated goal', async () => {
        db.runningGoal.findMany.mockResolvedValueOnce([
            { ...raceGoal, goalType: 'BASE_BUILDING', targetEventDate: null, targetDistanceM: null },
        ]);
        const response = await post({ ...validBody, endDate: '2027-02-28' });
        expect(response.status).toBe(201);
        expect(tx.plan.create.mock.calls[0][0].data.endDate.toISOString().slice(0, 10)).toBe('2027-02-28');
    });
});
