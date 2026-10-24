import { redirect } from '@sveltejs/kit';
import { addDays, dateInTimezone, toIsoDate, todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile, getRunningGoals } from '$lib/prisma/prisma';
import { getActivePlan, type ActivePlan } from '$lib/server/planner/repository';
import { MAX_RETRIES, finalizeWeek, staleReason } from '$lib/server/planner/week-generation';
import { hashSessionToken } from '$lib/server/session-token';
import { toPlanView, type PlanView, type PlanViewActivity, type PlanViewSession } from '$lib/planner/plan-view';
import { unconfirmedSessions } from '$lib/planner/core/pull';
import { activityKindOf } from '$lib/planner/core/match';
import { db } from '$lib/database';
import type { PlanRationale } from '$lib/planner/core/explain';
import type { ConflictRecord } from '$lib/planner/core/conflict';
import { buildAdaptView, finalizePendingRevision } from '$lib/server/planner/adapt';
import type { AdaptView } from '$lib/planner/adapt-view';

type StoredWeek = ActivePlan['phases'][number]['weeks'][number];

/**
 * A week whose request finished while no tab was open: finalize it now (ADR 0014). A request no
 * proxy call will finish is failed here, so the athlete can retry it (#423).
 */
const awaitsFinalize = (w: StoredWeek) =>
    w.generation !== 'GENERATED' &&
    w.aiRequest != null &&
    (w.aiRequest.status === 'DONE' ||
        (w.aiRequest.status === 'FAILED' && w.generation !== 'FAILED') ||
        staleReason(w.aiRequest) != null);

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

export const load = async ({
    locals,
    cookies,
}: {
    locals: App.Locals;
    cookies: { get(name: string): string | undefined };
}): Promise<{
    plan: PlanView | null;
    proxySession: string | null;
    activities: PlanViewActivity[];
    adapt: AdaptView | null;
}> => {
    const userId = locals.user?.id;
    if (!userId) redirect(302, '/app/login');

    const [stored, profile, goals] = await Promise.all([
        getActivePlan(userId),
        getAthleteProfile(userId),
        getRunningGoals(userId, { includeArchived: false }),
    ]);
    if (!stored) return { plan: null, proxySession: null, activities: [], adapt: null };

    const timezone = profile?.timezone ?? 'UTC';
    const today = todayInTimezone(timezone);
    let plan = stored;
    const unfinalized = plan.phases.flatMap((p) => p.weeks).filter(awaitsFinalize);
    for (const w of unfinalized) await finalizeWeek(userId, w.id);
    const revised = await finalizePendingRevision(userId, plan, today);
    if (unfinalized.length > 0 || revised) plan = (await getActivePlan(userId)) ?? plan;

    const session = cookies.get('session');
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
                              retriesLeft: Math.max(0, MAX_RETRIES - w.aiRequest.retryCount),
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
    // The proxy matches the hashed token against User.userAuthToken; the raw cookie stays httpOnly.
    const current = view.currentWeekIndex != null ? view.weeks[view.currentWeekIndex] : null;
    const [activities, adapt] = await Promise.all([
        current ? weekActivities(userId, current, timezone) : Promise.resolve([]),
        buildAdaptView(userId, plan, locals.user.subscriptionTier, today, timezone),
    ]);
    return { plan: view, proxySession: session ? hashSessionToken(session) : null, activities, adapt };
};
