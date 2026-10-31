import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import RecoveryBudgetBar from './RecoveryBudgetBar.svelte';
import SessionsDoneBar from './SessionsDoneBar.svelte';
import type { PlanViewSession, PlanViewWeek } from '$lib/planner/plan-view';

afterEach(cleanup);

const session = (plannedLoad: number, extra: Partial<PlanViewSession> = {}): PlanViewSession => ({
    id: `s-${plannedLoad}`,
    kind: 'RUNNING',
    scheduledDate: '2026-10-20',
    sequence: 0,
    status: 'PLANNED',
    plannedLoad,
    loadMethod: 'LABEL_TABLE',
    staleAnchor: false,
    activityId: null,
    notConfirmed: false,
    body: { bodyVersion: 1, title: 'Run', keySession: null, reason: null, cutKey: null, steps: [] },
    ...extra,
});

type BarWeek = Pick<PlanViewWeek, 'budget' | 'sessions' | 'decision'>;

const struck = (recoveryBudget: number | null, absence: PlanViewWeek['budget']['absence'] = null) => ({
    struck: true,
    recoveryBudget,
    chronicLoad: recoveryBudget == null ? null : 50,
    chronicFallbackShare: recoveryBudget == null ? null : 0.3,
    absence,
});

const week = (overrides: Partial<BarWeek> = {}): BarWeek => ({
    budget: struck(455),
    sessions: [session(300), session(90, { kind: 'STRENGTH', loadMethod: 'DURATION' })],
    decision: null,
    ...overrides,
});

describe('RecoveryBudgetBar', () => {
    it('shows planned load against the budget, the chronic load and both fallback shares', () => {
        render(RecoveryBudgetBar, { week: week() });
        expect(screen.getByText('390 of 455 TRIMP')).toBeInTheDocument();
        expect(screen.getByText(/chronic load of 50 TRIMP\/day/)).toBeInTheDocument();
        expect(screen.getByText(/23% of this week's planned load/)).toBeInTheDocument();
        expect(screen.getByText(/30% of your chronic load/)).toBeInTheDocument();
        expect(screen.getByRole('meter', { name: /recovery budget/i })).not.toHaveClass('gc-over');
    });

    it('turns red and shakes when the week is over budget', () => {
        render(RecoveryBudgetBar, { week: week({ budget: struck(300) }) });
        expect(screen.getByRole('meter', { name: /recovery budget/i })).toHaveClass('gc-over');
        expect(screen.getByText('Over budget by 90 TRIMP')).toBeInTheDocument();
    });

    it('says when the athlete chose to keep the week over budget', () => {
        render(RecoveryBudgetBar, { week: week({ budget: struck(300), decision: 'KEPT' }) });
        expect(screen.getByText(/you kept this week over budget/i)).toBeInTheDocument();
    });

    it('is locked and says it needs tracked activity without Garmin', () => {
        render(RecoveryBudgetBar, { week: week({ budget: struck(null, 'NO_TRACKED_ACTIVITY') }) });
        expect(screen.getByText(/needs tracked activity/i)).toBeInTheDocument();
        expect(screen.queryByRole('meter')).toBeNull();
    });

    it('says it needs 28 days of tracked training, not an empty gauge', () => {
        render(RecoveryBudgetBar, { week: week({ budget: struck(null, 'SHORT_HISTORY') }) });
        expect(screen.getByText(/needs 28 days of tracked training/i)).toBeInTheDocument();
        expect(screen.queryByRole('meter')).toBeNull();
    });

    it('says the budget is struck when the week is written', () => {
        render(RecoveryBudgetBar, {
            week: week({
                budget: {
                    struck: false,
                    recoveryBudget: null,
                    chronicLoad: null,
                    chronicFallbackShare: null,
                    absence: null,
                },
            }),
        });
        expect(screen.getByText(/struck when this week is written/i)).toBeInTheDocument();
    });
});

describe('SessionsDoneBar', () => {
    it('counts done sessions of every kind together', () => {
        render(SessionsDoneBar, {
            week: {
                sessions: [
                    session(1, { status: 'DONE' }),
                    session(2),
                    session(3, { kind: 'STRENGTH', status: 'DONE' }),
                ],
            },
        });
        expect(screen.getByText('2 of 3 sessions done')).toBeInTheDocument();
        expect(screen.getByRole('meter', { name: /sessions done/i })).toHaveAttribute('aria-valuenow', '2');
    });
});
