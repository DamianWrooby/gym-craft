// Turns the athlete's stored context plus their wizard answers into a plan record.
// Pure: the route loads the context, this lays the horizon out, the repository writes it.
import { addDays, toIsoDate } from '$lib/utils/iso-week';
import { isRunningTypeKey } from '$lib/utils/activity-type';
import { getSchool } from '$lib/planner/schools/catalogue';
import { deriveAnchor, type Anchor } from '$lib/planner/core/anchor';
import { layoutHorizon, type Layout, type RecentVolume } from '$lib/planner/core/layout';
import { WEEKDAYS } from '$lib/planner/wizard';
import type { CreatePlanInput, RaceResultInput } from './validation';

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
}

export type BuildPlanResult =
    { ok: true; record: NewPlanRecord; anchor: Anchor | null } | { ok: false; reason: string };

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

export function buildPlan(context: PlanningContext, input: CreatePlanInput, today: string): BuildPlanResult {
    const goal = context.goals.find((g) => g.id === input.goalId && !g.archivedAt);
    if (!goal) return { ok: false, reason: 'Goal not found' };

    const goalDate = goal.targetEventDate ? toIsoDate(goal.targetEventDate) : null;
    const endDate = goalDate ?? input.endDate;
    if (!endDate) return { ok: false, reason: 'Choose when the horizon ends' };
    if (endDate <= today) return { ok: false, reason: 'The horizon must end after today' };

    const anchor = deriveAnchor({
        results: [
            ...context.raceResults.map((r) => ({ ...r, date: toIsoDate(r.date) })),
            ...input.raceResults.map((r, i) => ({ ...r, id: `new-${i}` })),
        ],
        runs: context.activities
            .filter((a) => isRunningTypeKey(a.activityType) && a.distanceM)
            .map((a) => ({
                id: a.id,
                date: toIsoDate(a.startTime),
                distanceM: a.distanceM!,
                durationSec: a.movingDurationSec ?? a.durationSec,
            })),
        goalDistanceM: goal.targetDistanceM,
        today,
    });

    const result = layoutHorizon({
        school: getSchool(input.schoolId),
        startDate: today,
        endDate,
        goal: { isRace: goal.goalType === 'RACE' && goalDate != null, distanceM: goal.targetDistanceM },
        compression: input.compression ?? undefined,
        recentVolume: recentRunningVolume(context.activities, today),
        runsPerWeek: WEEKDAYS.filter((d) => input.availability[d]).length,
        anchorPresent: anchor != null,
    });
    if (!result.ok) return result;

    return {
        ok: true,
        anchor,
        record: {
            goalId: goal.id,
            startDate: today,
            endDate,
            availability: input.availability,
            longRunDay: input.longRunDay,
            hrZoneBounds: input.hrZoneBounds,
            raceResults: input.raceResults,
            layout: result.layout,
        },
    };
}
