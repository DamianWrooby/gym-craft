// Turns the athlete's stored context plus their wizard answers into a plan record.
// Pure: the route loads the context, this lays the horizon out, the repository writes it.
import { addDays, toIsoDate } from '$lib/utils/iso-week';
import { isRunningTypeKey } from '$lib/utils/activity-type';
import { getSchool } from '$lib/planner/schools/catalogue';
import { deriveAnchor, type Anchor } from '$lib/planner/core/anchor';
import { horizonWeekCount, layoutHorizon, type Layout, type RecentVolume } from '$lib/planner/core/layout';
import { recommendSchool } from '$lib/planner/core/recommend';
import { explainPlan, type PlanRationale } from '$lib/planner/core/explain';
import { WEEKDAYS } from '$lib/planner/wizard';
import type { CreatePlanInput, RaceResultInput } from './validation';
import { buildWeekPrompt, type AiRequestInput } from './week-prompt';
import { fixturesBetween, toFixtureGoal } from '$lib/planner/core/fixtures';

export interface ContextGoal {
    id: string;
    goalType: string;
    targetEventName: string | null;
    targetEventDate: Date | null;
    targetDistanceM: number | null;
    archivedAt: Date | null;
}

export interface ContextActivity {
    id: string;
    activityType: string;
    startTime: Date;
    durationSec: number;
    movingDurationSec: number | null;
    distanceM: number | null;
}

export interface PlanningContext {
    goals: ContextGoal[];
    raceResults: { id: string; date: Date; distanceM: number; timeSec: number }[];
    /** Activities of the last 90 days. */
    activities: ContextActivity[];
}

export interface NewPlanRecord {
    goalId: string;
    startDate: string;
    endDate: string;
    availability: CreatePlanInput['availability'];
    longRunDay: number;
    hrZoneBounds: CreatePlanInput['hrZoneBounds'];
    raceResults: RaceResultInput[];
    layout: Layout;
    rationale: PlanRationale;
}

export type BuildPlanResult =
    | { ok: true; record: NewPlanRecord; anchor: Anchor | null; week1Prompt: AiRequestInput }
    | { ok: false; reason: string };

const RECENT_VOLUME_DAYS = 28;

export function recentRunningVolume(activities: ContextActivity[], today: string): RecentVolume {
    const from = addDays(today, -RECENT_VOLUME_DAYS);
    let seconds = 0;
    let metres = 0;
    for (const a of activities) {
        const day = toIsoDate(a.startTime);
        if (!isRunningTypeKey(a.activityType) || day < from || day > today) continue;
        seconds += a.movingDurationSec ?? a.durationSec;
        metres += a.distanceM ?? 0;
    }
    const weeks = RECENT_VOLUME_DAYS / 7;
    return { minutesPerWeek: Math.round(seconds / 60 / weeks), metresPerWeek: Math.round(metres / weeks) };
}

/** The anchor for one generation: stored results, any just entered, and recent runs (ADR 0010). */
export function anchorFromContext(
    context: Pick<PlanningContext, 'raceResults' | 'activities'>,
    newResults: { id: string; date: string; distanceM: number; timeSec: number }[],
    goalDistanceM: number | null,
    today: string,
): Anchor | null {
    return deriveAnchor({
        results: [...context.raceResults.map((r) => ({ ...r, date: toIsoDate(r.date) })), ...newResults],
        runs: context.activities
            .filter((a) => isRunningTypeKey(a.activityType) && a.distanceM)
            .map((a) => ({
                id: a.id,
                date: toIsoDate(a.startTime),
                distanceM: a.distanceM!,
                durationSec: a.movingDurationSec ?? a.durationSec,
            })),
        goalDistanceM,
        today,
    });
}

const goalTypeName = (goalType: string) => goalType.replace('_', ' ').toLowerCase();

export function buildPlan(context: PlanningContext, input: CreatePlanInput, today: string): BuildPlanResult {
    const goal = context.goals.find((g) => g.id === input.goalId && !g.archivedAt);
    if (!goal) return { ok: false, reason: 'Goal not found' };

    const goalDate = goal.targetEventDate ? toIsoDate(goal.targetEventDate) : null;
    const endDate = goalDate ?? input.endDate;
    if (!endDate) return { ok: false, reason: 'Choose when the horizon ends' };
    if (endDate <= today) return { ok: false, reason: 'The horizon must end after today' };

    const anchor = anchorFromContext(
        context,
        input.raceResults.map((r, i) => ({ ...r, id: `new-${i}` })),
        goal.targetDistanceM,
        today,
    );

    const school = getSchool(input.schoolId);
    const layoutGoal = { isRace: goal.goalType === 'RACE' && goalDate != null, distanceM: goal.targetDistanceM };
    const recentVolume = recentRunningVolume(context.activities, today);
    const runsPerWeek = WEEKDAYS.filter((d) => input.availability[d]).length;
    const result = layoutHorizon({
        school,
        startDate: today,
        endDate,
        goal: layoutGoal,
        compression: input.compression ?? undefined,
        recentVolume,
        runsPerWeek,
        anchorPresent: anchor != null,
    });
    if (!result.ok) return result;

    const { recommended } = recommendSchool({
        goal: layoutGoal,
        horizonWeeks: horizonWeekCount(today, endDate),
        anchorPresent: anchor != null,
        recentMetresPerWeek: recentVolume.metresPerWeek,
    });
    const rationale = explainPlan({
        school,
        layout: result.layout,
        goal: { name: goal.targetEventName ?? goalTypeName(goal.goalType), date: goalDate },
        recommended,
        anchor,
        recentVolume,
        runsPerWeek,
        longRunDay: input.longRunDay,
    });

    const firstWeek = result.layout.weeks[0];
    const firstPhase = result.layout.phases.find((p) => p.ordinal === firstWeek.phaseOrdinal)!;
    const week1Prompt = buildWeekPrompt({
        school,
        phase: firstPhase,
        week: {
            ...firstWeek,
            from: today > firstWeek.startDate ? today : firstWeek.startDate,
            to: endDate < firstWeek.endDate ? endDate : firstWeek.endDate,
            timeTrialDistanceM: result.layout.timeTrial?.weekIndex === 0 ? result.layout.timeTrial.distanceM : null,
        },
        availability: input.availability,
        longRunDay: input.longRunDay,
        anchor,
        fixtures: fixturesBetween(
            context.goals.filter((g) => !g.archivedAt).map(toFixtureGoal),
            goal.id,
            today > firstWeek.startDate ? today : firstWeek.startDate,
            endDate < firstWeek.endDate ? endDate : firstWeek.endDate,
        ),
    });

    return {
        ok: true,
        anchor,
        week1Prompt,
        record: {
            goalId: goal.id,
            startDate: today,
            endDate,
            availability: input.availability,
            longRunDay: input.longRunDay,
            hrZoneBounds: input.hrZoneBounds,
            raceResults: input.raceResults,
            layout: result.layout,
            rationale,
        },
    };
}
