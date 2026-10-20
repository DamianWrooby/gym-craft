import { redirect } from '@sveltejs/kit';
import { toIsoDate, todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile, getRunningGoals } from '$lib/prisma/prisma';
import { getActivePlan, type ActivePlan } from '$lib/server/planner/repository';
import { MAX_RETRIES, finalizeWeek } from '$lib/server/planner/week-generation';
import { hashSessionToken } from '$lib/server/session-token';
import { toPlanView, type PlanView, type PlanViewSession } from '$lib/planner/plan-view';
import type { PlanRationale } from '$lib/planner/core/explain';

type StoredWeek = ActivePlan['phases'][number]['weeks'][number];

/** A week whose request finished while no tab was open: finalize it now (ADR 0014). */
const awaitsFinalize = (w: StoredWeek) =>
    w.generation !== 'GENERATED' &&
    (w.aiRequest?.status === 'DONE' || (w.aiRequest?.status === 'FAILED' && w.generation !== 'FAILED'));

function toSession(s: StoredWeek['sessions'][number]): PlanViewSession {
    const anchor = s.anchor as { stale?: boolean } | null;
    return {
        id: s.id,
        kind: s.kind,
        scheduledDate: toIsoDate(s.scheduledDate),
        sequence: s.sequence,
        status: s.status,
        plannedLoad: s.plannedLoad,
        staleAnchor: anchor?.stale === true,
        body: s.body as unknown as PlanViewSession['body'],
    };
}

export const load = async ({
    locals,
    cookies,
}: {
    locals: App.Locals;
    cookies: { get(name: string): string | undefined };
}): Promise<{ plan: PlanView | null; proxySession: string | null }> => {
    const userId = locals.user?.id;
    if (!userId) redirect(302, '/app/login');

    const [stored, profile, goals] = await Promise.all([
        getActivePlan(userId),
        getAthleteProfile(userId),
        getRunningGoals(userId, { includeArchived: false }),
    ]);
    if (!stored) return { plan: null, proxySession: null };

    let plan = stored;
    const unfinalized = plan.phases.flatMap((p) => p.weeks).filter(awaitsFinalize);
    if (unfinalized.length > 0) {
        for (const w of unfinalized) await finalizeWeek(userId, w.id);
        plan = (await getActivePlan(userId)) ?? plan;
    }

    const session = cookies.get('session');
    const today = todayInTimezone(profile?.timezone ?? 'UTC');
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
                    sessions: w.sessions.map(toSession),
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
    return { plan: view, proxySession: session ? hashSessionToken(session) : null };
};
