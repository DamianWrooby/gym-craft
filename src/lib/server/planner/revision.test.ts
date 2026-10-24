import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
    athleteProfile: { findUnique: vi.fn() },
    plan: { findFirst: vi.fn() },
    activity: { findMany: vi.fn() },
    plannedSession: { findMany: vi.fn() },
    planWeek: { update: vi.fn() },
}));
vi.mock('$lib/database', () => ({ db }));

import { reevaluateCurrentWeek } from './revision';

const day = (d: string) => new Date(`${d}T00:00:00Z`);

const athleteSession = (id: string, date: string, plannedLoad: number, body: Record<string, unknown>) => ({
    id,
    origin: 'ATHLETE',
    status: 'PLANNED',
    kind: 'RUNNING',
    scheduledDate: day(date),
    sequence: 0,
    plannedLoad,
    loadMethod: 'LABEL_TABLE',
    activityId: null,
    body: { cutKey: null, keySession: null, steps: [{ label: 'easy', durationMin: 40 }], ...body },
});

const weekWith = (overrides: Record<string, unknown> = {}) => ({
    id: 'week-1',
    generation: 'GENERATED',
    startDate: day('2026-10-19'),
    endDate: day('2026-10-25'),
    recoveryBudget: 100,
    revisedAt: null,
    revisionGeneration: null,
    revisionRequest: null,
    aiRequest: null,
    decision: null,
    conflict: null,
    sessions: [
        athleteSession('s1', '2026-10-22', 80, { title: 'My intervals', keySession: 'hard' }),
        athleteSession('s2', '2026-10-24', 60, { title: 'My easy run' }),
    ],
    ...overrides,
});

const planWith = (week: ReturnType<typeof weekWith>) => ({
    id: 'plan-1',
    phases: [{ id: 'phase-1', school: 'POLARIZED', weeks: [week] }],
});

beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-21T12:00:00Z') });
    db.athleteProfile.findUnique.mockResolvedValue({ timezone: 'UTC' });
    db.activity.findMany.mockResolvedValue([]);
    db.plannedSession.findMany.mockResolvedValue([]);
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('reevaluateCurrentWeek over athlete sessions', () => {
    it('stores an ask offering the athlete session when the week is over budget', async () => {
        db.plan.findFirst.mockResolvedValue(planWith(weekWith()));

        expect(await reevaluateCurrentWeek('user-1', 'UNSCHEDULED')).toEqual({ kind: 'ask' });

        const { data } = db.planWeek.update.mock.calls[0][0];
        expect(data.decision).toBe('PENDING');
        expect(data.revisionReason).toMatchObject({ outcome: 'ask', overspend: 40 });
        expect(data.conflict.budget).toMatchObject({
            kind: 'ASK',
            removed: [],
            keySession: { scheduledDate: '2026-10-22', sequence: 0 },
            facts: { offered: { title: 'My intervals', options: ['DROP', 'DOWNGRADE', 'KEEP'] }, overspend: 40 },
        });
    });

    it('does not ask again once the athlete answered this week', async () => {
        db.plan.findFirst.mockResolvedValue(planWith(weekWith({ decision: 'KEPT' })));

        expect(await reevaluateCurrentWeek('user-1', 'UNSCHEDULED')).toEqual({ kind: 'ask' });

        const { data } = db.planWeek.update.mock.calls[0][0];
        expect(data.decision).toBeUndefined();
        expect(data.conflict).toBeUndefined();
    });
});
