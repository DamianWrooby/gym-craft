// The shape the /app/plan page renders. Built on the server from the stored plan; pure.
import { tuneUpFixtures, type FixtureGoal, type TuneUpFixture } from './core/fixtures';
import { getSchool, isSchoolId } from './schools/catalogue';
import type { SchoolId, VolumeUnit } from './schools/types';
import type { PlanRationale } from './core/explain';
import { pullTarget, unconfirmedSessions } from './core/pull';
import type { OtherBody, PlannedLoadMethod, RunningBody, SessionKind, StrengthBody } from './core/session';
import { evaluateWeek, type WeekEvaluation } from './core/budget';
import type { ConflictRecord } from './core/conflict';

export interface PlanViewSession {
    id: string;
    kind: SessionKind;
    scheduledDate: string;
    sequence: number;
    status: 'PLANNED' | 'DONE' | 'SKIPPED' | 'SUPERSEDED';
    plannedLoad: number;
    loadMethod: PlannedLoadMethod;
    /** The pace targets rest on an anchor that aged out of its window. */
    staleAnchor: boolean;
    body: RunningBody | StrengthBody | OtherBody;
}

/** The AI request writing a week, as far as the page needs it. */
export interface PlanViewRequest {
    id: string;
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
    retriesLeft: number;
}

export interface PlanViewPhase {
    ordinal: number;
    name: string;
    intent: string;
    source: 'SCHOOL' | 'LEAD_IN';
    startDate: string;
    endDate: string;
    weekIndexes: number[];
}

export interface PlanViewWeek {
    id: string;
    index: number;
    phaseOrdinal: number;
    startDate: string;
    endDate: string;
    inHorizonDays: number;
    generation: 'PENDING' | 'GENERATED' | 'FAILED';
    isCutback: boolean;
    isTaper: boolean;
    /** The time trial scheduled in this week, when no anchor existed at layout. */
    timeTrialDistanceM: number | null;
    volumeTarget: number;
    volumeUnit: VolumeUnit;
    strengthSessionTarget: number;
    sessions: PlanViewSession[];
    request: PlanViewRequest | null;
    budget: PlanViewBudget;
    /** What finalize cut or asked; null when the week stands as written. */
    conflict: ConflictRecord | null;
    /** The athlete's answer to an ask; KEPT is the per-week override. */
    decision: 'PENDING' | 'DROPPED' | 'DOWNGRADED' | 'KEPT' | null;
}

/** The recovery budget as frozen on the week at the pull (ADR 0011). */
export interface PlanViewBudget {
    struck: boolean;
    recoveryBudget: number | null;
    chronicLoad: number | null;
    chronicFallbackShare: number | null;
    absence: 'NO_TRACKED_ACTIVITY' | 'SHORT_HISTORY' | null;
}

export interface PlanView {
    id: string;
    school: { id: SchoolId | null; name: string; lore: string; tagline: string };
    goalName: string;
    startDate: string;
    endDate: string;
    phases: PlanViewPhase[];
    weeks: PlanViewWeek[];
    fixtures: TuneUpFixture[];
    /** Index of the week holding today; null before the start or after the end. */
    currentWeekIndex: number | null;
    /** Null for plans created before the rationale was stored. */
    rationale: PlanRationale | null;
    /** The week a pull would write today, with past sessions still to confirm; null when none. */
    pull: { weekIndex: number; unconfirmed: PlanViewSession[] } | null;
}

export interface StoredPlan {
    id: string;
    startDate: string;
    endDate: string;
    goalId: string;
    goalName: string;
    rationale: PlanRationale | null;
    phases: {
        ordinal: number;
        name: string;
        intent: string;
        source: 'SCHOOL' | 'LEAD_IN';
        school: string;
        startDate: string;
        endDate: string;
        weeks: Omit<PlanViewWeek, 'index' | 'phaseOrdinal'>[];
    }[];
}

export function toPlanView(plan: StoredPlan, goals: FixtureGoal[], today: string): PlanView {
    const weeks: PlanViewWeek[] = [];
    const phases: PlanViewPhase[] = plan.phases.map((p) => {
        const weekIndexes = p.weeks.map((w) => {
            weeks.push({ ...w, index: weeks.length, phaseOrdinal: p.ordinal });
            return weeks.length - 1;
        });
        return {
            ordinal: p.ordinal,
            name: p.name,
            intent: p.intent,
            source: p.source,
            startDate: p.startDate,
            endDate: p.endDate,
            weekIndexes,
        };
    });

    // The school shown in the header is the one the plan's latest school phase runs under.
    const schoolId = [...plan.phases].reverse().find((p) => p.source === 'SCHOOL')?.school;
    const school = isSchoolId(schoolId) ? getSchool(schoolId) : null;

    const current = weeks.find((w) => today >= w.startDate && today <= w.endDate);
    const pullWeek = pullTarget(
        weeks.map((w) => ({ ...w, hasRequest: w.request != null })),
        today,
    );
    return {
        id: plan.id,
        school: school
            ? { id: school.id, name: school.name, lore: school.lore, tagline: school.tagline }
            : { id: null, name: schoolId ?? 'Unknown school', lore: '', tagline: '' },
        goalName: plan.goalName,
        startDate: plan.startDate,
        endDate: plan.endDate,
        phases,
        weeks,
        fixtures: tuneUpFixtures({
            goals,
            boundGoalId: plan.goalId,
            startDate: plan.startDate,
            endDate: plan.endDate,
            weeks,
        }),
        currentWeekIndex: current && today >= plan.startDate && today <= plan.endDate ? current.index : null,
        rationale: plan.rationale,
        pull: pullWeek
            ? {
                  weekIndex: pullWeek.index,
                  // Last week's and this week's: older ones stay "not confirmed" without blocking.
                  unconfirmed: unconfirmedSessions(
                      weeks.filter((w) => current && w.index >= current.index - 1).flatMap((w) => w.sessions),
                      today,
                  ),
              }
            : null,
    };
}

export function formatVolume(value: number, unit: VolumeUnit): string {
    if (unit === 'METRES') return `${Math.round(value / 100) / 10} km`;
    const h = Math.floor(value / 60);
    const m = value % 60;
    return h > 0 ? `${h} h ${m.toString().padStart(2, '0')} min` : `${m} min`;
}

export type BudgetBarState =
    | { kind: 'unstruck' }
    | { kind: 'needs-tracked-activity' }
    | { kind: 'needs-tracked-training' }
    | {
          kind: 'within' | 'over';
          evaluation: WeekEvaluation;
          budget: number;
          chronicLoad: number | null;
          chronicFallbackShare: number | null;
          /** The athlete chose to keep this week over budget. */
          kept: boolean;
      };

/** One bar for running and strength together; never split by kind. */
export function budgetBarState(week: Pick<PlanViewWeek, 'budget' | 'sessions' | 'decision'>): BudgetBarState {
    const { budget } = week;
    if (!budget.struck) return { kind: 'unstruck' };
    if (budget.recoveryBudget == null) {
        return budget.absence === 'NO_TRACKED_ACTIVITY'
            ? { kind: 'needs-tracked-activity' }
            : { kind: 'needs-tracked-training' };
    }
    // A skipped session spends nothing; a manual done keeps its planned load (story 65).
    const evaluation = evaluateWeek(
        week.sessions
            .filter((s) => s.status !== 'SKIPPED')
            .map((s) => ({ plannedLoad: s.plannedLoad, method: s.loadMethod })),
        budget.recoveryBudget,
    );
    return {
        kind: evaluation.verdict === 'over' ? 'over' : 'within',
        evaluation,
        budget: budget.recoveryBudget,
        chronicLoad: budget.chronicLoad,
        chronicFallbackShare: budget.chronicFallbackShare,
        kept: week.decision === 'KEPT',
    };
}

export function sessionsDone(week: Pick<PlanViewWeek, 'sessions'>): { done: number; total: number } {
    return { done: week.sessions.filter((s) => s.status === 'DONE').length, total: week.sessions.length };
}
