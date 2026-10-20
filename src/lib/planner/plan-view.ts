// The shape the /app/plan page renders. Built on the server from the stored plan; pure.
import { tuneUpFixtures, type FixtureGoal, type TuneUpFixture } from './core/fixtures';
import { getSchool, isSchoolId } from './schools/catalogue';
import type { SchoolId, VolumeUnit } from './schools/types';
import type { PlanRationale } from './core/explain';
import { pullTarget, unconfirmedSessions } from './core/pull';
import type { OtherBody, RunningBody, SessionKind, StrengthBody } from './core/session';

export interface PlanViewSession {
    id: string;
    kind: SessionKind;
    scheduledDate: string;
    sequence: number;
    status: 'PLANNED' | 'DONE' | 'SKIPPED' | 'SUPERSEDED';
    plannedLoad: number;
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
