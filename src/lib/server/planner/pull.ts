// Pull (ADR 0016): the athlete opens the current week, answers the week outlook, confirms past
// sessions, and the server writes the next week's AI request. The browser then runs it through the
// same finalize path as week 1. At most one request per week; pulls are never capped.
import { db } from '$lib/database';
import { addDays, toIsoDate } from '$lib/utils/iso-week';
import { getSchool, isSchoolId } from '$lib/planner/schools/catalogue';
import { OUTLOOK_FACTORS, pullTarget, type WeekOutlook } from '$lib/planner/core/pull';
import type { AvailabilityMap } from '$lib/planner/wizard';
import type { Prisma } from '@prisma/client';
import { anchorFromContext } from './build-plan';
import { getPlanningContext } from './repository';
import { buildWeekPrompt } from './week-prompt';
import { fixturesBetween, toFixtureGoal } from '$lib/planner/core/fixtures';
import { strikeWeekBudget } from './budget';

export interface PullInput {
    outlook: WeekOutlook;
    confirmations: { sessionId: string; status: 'DONE' | 'SKIPPED' }[];
}

export type PullOutcome =
    | { kind: 'no-plan' }
    | { kind: 'not-pullable' }
    | { kind: 'already-pulled' }
    | { kind: 'pulled'; weekId: string; aiRequestId: string };

class AlreadyPulledError extends Error {}

const asDate = (yyyymmdd: string) => new Date(`${yyyymmdd}T00:00:00Z`);

export async function pullWeek(
    userId: string,
    weekId: string,
    input: PullInput,
    model: string,
    today: string,
): Promise<PullOutcome> {
    const plan = await db.plan.findFirst({
        where: { userId, state: 'ACTIVE' },
        include: {
            goal: true,
            phases: { orderBy: { ordinal: 'asc' }, include: { weeks: { orderBy: { startDate: 'asc' } } } },
        },
    });
    if (!plan) return { kind: 'no-plan' };

    const weeks = plan.phases.flatMap((phase) =>
        phase.weeks.map((w) => ({
            ...w,
            phase,
            startDate: toIsoDate(w.startDate),
            endDate: toIsoDate(w.endDate),
            hasRequest: w.aiRequestId != null,
        })),
    );
    if (weeks.find((w) => w.id === weekId)?.hasRequest) return { kind: 'already-pulled' };
    const target = pullTarget(weeks, today);
    if (!target || target.id !== weekId) return { kind: 'not-pullable' };

    const { phase } = target;
    if (!isSchoolId(phase.school)) throw new Error(`Unknown school on phase: ${phase.school}`);
    // Re-derived at each pull, so a new race result improves this week; written weeks keep theirs.
    const context = await getPlanningContext(userId, today);
    const anchor = anchorFromContext(context, [], plan.goal.targetDistanceM, today);
    const planStart = toIsoDate(plan.startDate);
    const planEnd = toIsoDate(plan.endDate);
    const weekEnd = addDays(target.startDate, 6);
    const from = planStart > target.startDate ? planStart : target.startDate;
    const to = planEnd < weekEnd ? planEnd : weekEnd;
    const prompt = buildWeekPrompt({
        school: getSchool(phase.school),
        phase,
        week: {
            ...target,
            from,
            to,
        },
        availability: plan.availability as unknown as AvailabilityMap,
        longRunDay: plan.longRunDay,
        anchor,
        outlook: input.outlook,
        fixtures: fixturesBetween(context.goals.map(toFixtureGoal), plan.goalId, from, to),
    });

    // Struck once here and frozen on the week (ADR 0011); the outlook sizes it once (ADR 0024).
    const outlookFactor = OUTLOOK_FACTORS[input.outlook];
    const budget = await strikeWeekBudget(userId, today, target.inHorizonDays, outlookFactor);

    try {
        const aiRequestId = await db.$transaction(async (tx) => {
            for (const c of input.confirmations) {
                await tx.plannedSession.updateMany({
                    where: { id: c.sessionId, userId, status: 'PLANNED', scheduledDate: { lt: asDate(today) } },
                    data: { status: c.status },
                });
            }
            const request = await tx.aiRequest.create({
                data: { userId, model, input: prompt as unknown as Prisma.InputJsonValue },
                select: { id: true },
            });
            // Claiming only a week with no request keeps it to one request, even under a race.
            const claimed = await tx.planWeek.updateMany({
                where: { id: target.id, userId, aiRequestId: null },
                data: { aiRequestId: request.id, outlook: input.outlook, outlookFactor, ...budget },
            });
            if (claimed.count === 0) throw new AlreadyPulledError();
            return request.id;
        });
        return { kind: 'pulled', weekId: target.id, aiRequestId };
    } catch (e) {
        if (e instanceof AlreadyPulledError || (e as { code?: string })?.code === 'P2002') {
            return { kind: 'already-pulled' };
        }
        throw e;
    }
}
