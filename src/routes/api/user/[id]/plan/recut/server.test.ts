import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays } from '$lib/utils/iso-week';
import { layoutHorizon } from '$lib/planner/core/layout';
import { getSchool } from '$lib/planner/schools/catalogue';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));
vi.mock('$lib/prisma/prisma', () => ({ getAthleteProfile: vi.fn(async () => ({ timezone: 'UTC' })) }));

const tx = vi.hoisted(() => ({
    planWeek: { deleteMany: vi.fn() },
    planPhase: { deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    plan: { update: vi.fn() },
    runningGoal: { update: vi.fn() },
}));
const db = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock('$lib/database', () => ({ db }));

const repository = vi.hoisted(() => ({ getActivePlan: vi.fn(), getPlanningContext: vi.fn() }));
vi.mock('$lib/server/planner/repository', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ...repository,
}));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;
const MONDAY = '2026-10-12';
const day = (d: string) => new Date(`${d}T00:00:00Z`);
const END = addDays(MONDAY, 7 * 20 - 1);

/** A 20-week polarized plan with weeks 1–2 written. */
function activePlan() {
    const result = layoutHorizon({
        school: getSchool('POLARIZED'),
        startDate: MONDAY,
        endDate: END,
        goal: { isRace: true, distanceM: 21097 },
        recentVolume: { minutesPerWeek: 200, metresPerWeek: 40000 },
        runsPerWeek: 4,
        anchorPresent: true,
    });
    if (!result.ok) throw new Error(result.reason);
    const { phases, weeks } = result.layout;
    return {
        id: 'plan-1',
        userId,
        goalId: 'goal-1',
        endDate: day(END),
        availability: { mon: true, tue: false, wed: true, thu: false, fri: true, sat: false, sun: true },
        goal: { goalType: 'RACE', targetEventDate: day(END), targetDistanceM: 21097 },
        phases: phases.map((p) => ({
            ...p,
            id: `phase-${p.ordinal}`,
            startDate: day(p.startDate),
            endDate: day(p.endDate),
            weeks: weeks
                .filter((w) => w.phaseOrdinal === p.ordinal)
                .map((w) => ({
                    ...w,
                    id: `week-${w.index}`,
                    startDate: day(w.startDate),
                    endDate: day(w.endDate),
                    generation: w.index < 2 ? 'GENERATED' : 'PENDING',
                    aiRequestId: w.index < 2 ? `request-${w.index}` : null,
                    timeTrialDistanceM: null,
                })),
        })),
    };
}

function post(body: unknown, id = userId) {
    return POST({
        request: new Request('http://test', { method: 'POST', body: JSON.stringify(body) }),
        params: { id },
        locals,
    });
}

beforeEach(() => {
    vi.useFakeTimers({ now: new Date(`${addDays(MONDAY, 2)}T12:00:00Z`), toFake: ['Date'] });
    repository.getActivePlan.mockResolvedValue(activePlan());
    repository.getPlanningContext.mockResolvedValue({ goals: [], raceResults: [], activities: [] });
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    tx.planWeek.deleteMany.mockResolvedValue({ count: 18 });
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/plan/recut', () => {
    it('returns 403 for another user', async () => {
        expect((await post({ schoolId: 'DANIELS' }, 'someone-else')).status).toBe(403);
    });

    it('refuses a recut that would move a GENERATED week', async () => {
        const response = await post({ endDate: addDays(MONDAY, 10), confirm: true });
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({ code: 'RECUT_REFUSED' });
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('returns the cost of a full re-lay without applying it', async () => {
        const response = await post({ schoolId: 'DANIELS' });
        expect(await response.json()).toEqual({
            data: {
                applied: false,
                kind: 'relaid',
                summary: 'Weeks 3–20 will be re-laid under Daniels.',
                losses: expect.any(Array),
            },
        });
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('applies a confirmed re-lay to the weeks not yet pulled', async () => {
        const response = await post({ schoolId: 'DANIELS', confirm: true });
        expect(response.status).toBe(200);
        expect(tx.planWeek.deleteMany).toHaveBeenCalledWith({
            where: {
                id: { in: Array.from({ length: 18 }, (_, i) => `week-${i + 2}`) },
                generation: 'PENDING',
                aiRequestId: null,
            },
        });
        const created = tx.planPhase.create.mock.calls.map((c) => c[0].data);
        expect(created.every((p) => p.school === 'DANIELS')).toBe(true);
        expect(created[0].ordinal).toBe(1);
        expect(tx.planPhase.deleteMany).toHaveBeenCalledWith({
            where: { planId: 'plan-1', id: { notIn: ['phase-0'] } },
        });
    });

    it('applies a race 5 days earlier at once and moves the goal date', async () => {
        const endDate = addDays(END, -5);
        const response = await post({ endDate });
        expect(await response.json()).toMatchObject({ data: { applied: true, kind: 'absorbed' } });
        expect(tx.plan.update).toHaveBeenCalledWith({ where: { id: 'plan-1' }, data: { endDate: day(endDate) } });
        expect(tx.runningGoal.update).toHaveBeenCalledWith({
            where: { id: 'goal-1' },
            data: { targetEventDate: day(endDate) },
        });
    });

    it('returns 409 when a week was pulled while the recut was open', async () => {
        tx.planWeek.deleteMany.mockResolvedValueOnce({ count: 17 });
        expect((await post({ schoolId: 'DANIELS', confirm: true })).status).toBe(409);
    });

    it('rejects an unknown school', async () => {
        expect((await post({ schoolId: 'LYDIARD' })).status).toBe(400);
    });
});
