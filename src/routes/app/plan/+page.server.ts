import { redirect } from '@sveltejs/kit';
import { toIsoDate, todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile, getRunningGoals } from '$lib/prisma/prisma';
import { getActivePlan } from '$lib/server/planner/repository';
import { toPlanView, type PlanView } from '$lib/planner/plan-view';
import type { PlanRationale } from '$lib/planner/core/explain';

export const load = async ({ locals }: { locals: App.Locals }): Promise<{ plan: PlanView | null }> => {
    const userId = locals.user?.id;
    if (!userId) redirect(302, '/app/login');

    const [plan, profile, goals] = await Promise.all([
        getActivePlan(userId),
        getAthleteProfile(userId),
        getRunningGoals(userId, { includeArchived: false }),
    ]);
    if (!plan) return { plan: null };

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
    return { plan: view };
};
