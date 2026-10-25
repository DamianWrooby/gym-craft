import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    getActivePlan: vi.fn(),
    getAthleteProfile: vi.fn(),
    getRunningGoals: vi.fn(),
    finalizeWeek: vi.fn(),
    finalizeRevision: vi.fn(),
    buildAdaptView: vi.fn(),
    db: { activity: { findMany: vi.fn() }, plannedSession: { findMany: vi.fn() } },
}));
vi.mock('$lib/database', () => ({ db: mocks.db }));
vi.mock('$lib/prisma/prisma', () => ({
    getAthleteProfile: mocks.getAthleteProfile,
    getRunningGoals: mocks.getRunningGoals,
}));
vi.mock('./repository', () => ({ getActivePlan: mocks.getActivePlan }));
vi.mock('./week-generation', () => ({ finalizeWeek: mocks.finalizeWeek }));
vi.mock('./revision', () => ({ finalizeRevision: mocks.finalizeRevision, revisionsUsed: vi.fn() }));
vi.mock('./adapt', async (importActual) => ({
    ...(await importActual<typeof import('./adapt')>()),
    buildAdaptView: mocks.buildAdaptView,
}));

import { readPlanPage } from './plan-page';

const userId = 'user-1';
const now = new Date('2026-10-14T09:00:00Z');
const day = (d: string) => new Date(`${d}T00:00:00Z`);
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

function storedWeek(over: Record<string, unknown> = {}) {
    return {
        id: 'week-1',
        startDate: day('2026-10-12'),
        endDate: day('2026-10-18'),
        inHorizonDays: 7,
        generation: 'GENERATED',
        isCutback: false,
        isTaper: false,
        timeTrialDistanceM: null,
        volumeTarget: 40,
        volumeUnit: 'KM',
        strengthSessionTarget: 2,
        budgetStruckAt: null,
        recoveryBudget: null,
        chronicLoad: null,
        chronicFallbackShare: null,
        budgetAbsence: null,
        conflict: null,
        decision: null,
        aiRequest: { id: 'req-1', status: 'DONE', retryCount: 0, updatedAt: minutesAgo(1) },
        revisionGeneration: null,
        revisionRequest: null,
        sessions: [],
        ...over,
    };
}

function storedPlan(week = storedWeek()) {
    return {
        id: 'plan-1',
        startDate: day('2026-10-12'),
        endDate: day('2027-01-31'),
        goalId: 'goal-1',
        goal: { targetEventName: 'Valencia Marathon', goalType: 'RACE' },
        rationale: null,
        phases: [
            {
                ordinal: 0,
                name: 'Base',
                intent: 'Build',
                source: 'SCHOOL',
                school: 'POLARIZED',
                startDate: day('2026-10-12'),
                endDate: day('2026-11-08'),
                weeks: [week],
            },
        ],
    };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    mocks.getAthleteProfile.mockResolvedValue({ timezone: 'UTC' });
    mocks.getRunningGoals.mockResolvedValue([]);
    mocks.getActivePlan.mockResolvedValue(storedPlan());
    mocks.buildAdaptView.mockResolvedValue({ adapt: true });
    mocks.db.activity.findMany.mockResolvedValue([]);
    mocks.db.plannedSession.findMany.mockResolvedValue([]);
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('readPlanPage', () => {
    it('returns nulls without an active plan', async () => {
        mocks.getActivePlan.mockResolvedValue(null);
        expect(await readPlanPage(userId, 'FREE')).toEqual({ plan: null, activities: [], adapt: null });
    });

    it('reads a settled plan once and settles nothing', async () => {
        const page = await readPlanPage(userId, 'FREE');
        expect(page.plan).toMatchObject({ id: 'plan-1', goalName: 'Valencia Marathon', currentWeekIndex: 0 });
        expect(page.plan!.weeks[0].request).toEqual({ id: 'req-1', status: 'DONE', retriesLeft: 2 });
        expect(page.adapt).toEqual({ adapt: true });
        expect(mocks.finalizeWeek).not.toHaveBeenCalled();
        expect(mocks.getActivePlan).toHaveBeenCalledOnce();
    });

    it('settles a week whose request finished with no tab open, then re-reads the plan', async () => {
        mocks.getActivePlan.mockResolvedValueOnce(storedPlan(storedWeek({ generation: 'PENDING' })));
        await readPlanPage(userId, 'FREE');
        expect(mocks.finalizeWeek).toHaveBeenCalledWith(userId, 'week-1');
        expect(mocks.getActivePlan).toHaveBeenCalledTimes(2);
    });

    it('settles a revision whose proxy call never started (#423)', async () => {
        mocks.getActivePlan.mockResolvedValueOnce(
            storedPlan(
                storedWeek({
                    revisionGeneration: 'PENDING',
                    revisionRequest: { id: 'req-2', status: 'PENDING', retryCount: 0, updatedAt: minutesAgo(10) },
                }),
            ),
        );
        await readPlanPage(userId, 'FREE');
        expect(mocks.finalizeRevision).toHaveBeenCalledWith(userId, 'week-1');
        expect(mocks.getActivePlan).toHaveBeenCalledTimes(2);
    });

    it("lists the current week's activities with their links", async () => {
        mocks.db.activity.findMany.mockResolvedValue([
            {
                id: 'a-1',
                activityName: 'Morning run',
                activityType: 'running',
                startTime: day('2026-10-13'),
                durationSec: 3000,
            },
            {
                id: 'a-2',
                activityName: 'Last week',
                activityType: 'running',
                startTime: day('2026-10-11'),
                durationSec: 3000,
            },
        ]);
        mocks.db.plannedSession.findMany.mockResolvedValue([{ id: 's-1', activityId: 'a-1' }]);
        const { activities } = await readPlanPage(userId, 'FREE');
        expect(activities).toEqual([
            {
                id: 'a-1',
                name: 'Morning run',
                kind: 'RUNNING',
                date: '2026-10-13',
                durationSec: 3000,
                linkedSessionId: 's-1',
            },
        ]);
    });
});
