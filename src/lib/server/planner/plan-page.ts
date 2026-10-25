// Reads the active plan for the plan page. A visit first settles every week job whose request
// finished while no tab was open (ADR 0014), then maps the stored plan to its view.
import { addDays, dateInTimezone, toIsoDate, todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile, getRunningGoals } from '$lib/prisma/prisma';
import { db } from '$lib/database';
import { toPlanView, type PlanView, type PlanViewActivity, type PlanViewSession } from '$lib/planner/plan-view';
import { unconfirmedSessions } from '$lib/planner/core/pull';
import { activityKindOf } from '$lib/planner/core/match';
import type { PlanRationale } from '$lib/planner/core/explain';
import type { ConflictRecord } from '$lib/planner/core/conflict';
import type { AdaptView } from '$lib/planner/adapt-view';
import type { SubscriptionTier } from '@/constants/subscription.constants';
import { getActivePlan, type ActivePlan } from './repository';
import { finalizeWeek } from './week-generation';
import { awaitsFinalize, retriesLeft } from './week-job';
import { buildAdaptView, finalizePendingRevision } from './adapt';

export interface PlanPage {
    plan: PlanView | null;
    activities: PlanViewActivity[];
    adapt: AdaptView | null;
}

type StoredWeek = ActivePlan['phases'][number]['weeks'][number];

function toSession(s: StoredWeek['sessions'][number], today: string): PlanViewSession {
    const anchor = s.anchor as { stale?: boolean } | null;
    const scheduledDate = toIsoDate(s.scheduledDate);
    return {
        id: s.id,
        kind: s.kind,
        scheduledDate,
        sequence: s.sequence,
        status: s.status,
        plannedLoad: s.plannedLoad,
        loadMethod: s.loadMethod as PlanViewSession['loadMethod'],
        staleAnchor: anchor?.stale === true,
        activityId: s.activityId,
        notConfirmed: !s.activityId && unconfirmedSessions([{ status: s.status, scheduledDate }], today).length > 0,
        body: s.body as unknown as PlanViewSession['body'],
    };
}

/** The current week's synced training, for linking by hand (story 64). */
async function weekActivities(
    userId: string,
    week: { startDate: string; endDate: string },
    timezone: string,
): Promise<PlanViewActivity[]> {
    // A day either side covers every timezone; the local date then decides the week.
    const rows = await db.activity.findMany({
        where: {
            userId,
            startTime: {
                gte: new Date(`${addDays(week.startDate, -1)}T00:00:00Z`),
                lt: new Date(`${addDays(week.endDate, 2)}T00:00:00Z`),
            },
        },
        select: { id: true, activityName: true, activityType: true, startTime: true, durationSec: true },
        orderBy: { startTime: 'asc' },
    });
    const links = await db.plannedSession.findMany({
        where: { userId, activityId: { in: rows.map((r) => r.id) } },
        select: { id: true, activityId: true },
    });
    const linkedTo = new Map(links.map((l) => [l.activityId, l.id]));
    return rows.flatMap((r) => {
        const kind = activityKindOf(r.activityType);
        const date = dateInTimezone(r.startTime, timezone);
        if (!kind || date < week.startDate || date > week.endDate) return [];
        return [
            {
                id: r.id,
                name: r.activityName ?? r.activityType,
                kind: kind.kind,
                date,
                durationSec: r.durationSec,
                linkedSessionId: linkedTo.get(r.id) ?? null,
            },
        ];
    });
}

/** The plan page's data for `userId`, after settling the plan's week jobs; no plan gives nulls. */
export async function readPlanPage(userId: string, tier: SubscriptionTier): Promise<PlanPage> {
    const [stored, profile, goals] = await Promise.all([
        getActivePlan(userId),
        getAthleteProfile(userId),
        getRunningGoals(userId, { includeArchived: false }),
    ]);
    if (!stored) return { plan: null, activities: [], adapt: null };

    const timezone = profile?.timezone ?? 'UTC';
    const today = todayInTimezone(timezone);
    let plan = stored;
    const unfinalized = plan.phases.flatMap((p) => p.weeks).filter((w) => awaitsFinalize(w.generation, w.aiRequest));
    for (const w of unfinalized) await finalizeWeek(userId, w.id);
    const revised = await finalizePendingRevision(userId, plan, today);
    if (unfinalized.length > 0 || revised) plan = (await getActivePlan(userId)) ?? plan;

    const view = toPlanView(
        {
            id: plan.id,
            startDate: toIsoDate(plan.startDate),
            endDate: toIsoDate(plan.endDate),
            goalId: plan.goalId,
            goalName: plan.goal.targetEventName ?? plan.goal.goalType,
            rationale: plan.rationale as unknown as PlanRationale | null,
            phases: plan.phases.map((p) => ({
                ordinal: p.ordinal,
                name: p.name,
                intent: p.intent,
                source: p.source,
                school: p.school,
                startDate: toIsoDate(p.startDate),
                endDate: toIsoDate(p.endDate),
                weeks: p.weeks.map((w) => ({
                    id: w.id,
                    startDate: toIsoDate(w.startDate),
                    endDate: toIsoDate(w.endDate),
                    inHorizonDays: w.inHorizonDays,
                    generation: w.generation,
                    isCutback: w.isCutback,
                    isTaper: w.isTaper,
                    timeTrialDistanceM: w.timeTrialDistanceM,
                    volumeTarget: w.volumeTarget,
                    volumeUnit: w.volumeUnit,
                    strengthSessionTarget: w.strengthSessionTarget,
                    sessions: w.sessions.map((s) => toSession(s, today)),
                    budget: {
                        struck: w.budgetStruckAt != null,
                        recoveryBudget: w.recoveryBudget,
                        chronicLoad: w.chronicLoad,
                        chronicFallbackShare: w.chronicFallbackShare,
                        absence: w.budgetAbsence,
                    },
                    conflict: w.conflict as unknown as ConflictRecord | null,
                    decision: w.decision,
                    request: w.aiRequest
                        ? {
                              id: w.aiRequest.id,
                              status: w.aiRequest.status,
                              retriesLeft: retriesLeft(w.aiRequest.retryCount),
                          }
                        : null,
                })),
            })),
        },
        goals.map((g) => ({
            id: g.id,
            date: g.targetEventDate ? toIsoDate(g.targetEventDate) : null,
            name: g.targetEventName,
            distanceM: g.targetDistanceM,
        })),
        today,
    );
    const current = view.currentWeekIndex != null ? view.weeks[view.currentWeekIndex] : null;
    const [activities, adapt] = await Promise.all([
        current ? weekActivities(userId, current, timezone) : Promise.resolve([]),
        buildAdaptView(userId, plan, tier, today, timezone),
    ]);
    return { plan: view, activities, adapt };
}
