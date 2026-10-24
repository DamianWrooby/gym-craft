// Recut persistence (ADRs 0015, 0019): reads the active plan into the pure recut, and writes a re-lay
// in one transaction. Free: layout only, no AI request, no revision cap (ADR 0016).
import { db } from '$lib/database';
import { toIsoDate } from '$lib/utils/iso-week';
import { isSchoolId } from '$lib/planner/schools/catalogue';
import { recut, type RecutInput, type RecutPlan, type RecutResult } from '$lib/planner/core/recut';
import { WEEKDAYS, type AvailabilityMap } from '$lib/planner/wizard';
import type { SchoolId } from '$lib/planner/schools/types';
import { anchorFromContext, recentRunningVolume } from './build-plan';
import { getPlanningContext, laidWeekRow, type ActivePlan } from './repository';

const asDate = (yyyymmdd: string) => new Date(`${yyyymmdd}T00:00:00Z`);

export type RecutChange = RecutInput['change'];

/** A week moved under the recut since it was read: it was pulled meanwhile. */
export class RecutConflictError extends Error {
    constructor() {
        super('A week was written while the recut was open; review it again');
    }
}

export async function planRecut(userId: string, plan: ActivePlan, today: string, change: RecutChange) {
    const context = await getPlanningContext(userId, today);
    const goalDate = plan.goal.targetEventDate ? toIsoDate(plan.goal.targetEventDate) : null;
    const phases = plan.phases.map((p) => {
        if (!isSchoolId(p.school)) throw new Error(`Unknown school on phase: ${p.school}`);
        return {
            key: p.key,
            ordinal: p.ordinal,
            name: p.name,
            intent: p.intent,
            source: p.source,
            school: p.school as SchoolId,
            volumeUnit: p.volumeUnit,
            startDate: toIsoDate(p.startDate),
            endDate: toIsoDate(p.endDate),
        };
    });
    const weeks = plan.phases
        .flatMap((p) => p.weeks.map((w) => ({ w, phaseOrdinal: p.ordinal })))
        .sort((a, b) => a.w.startDate.getTime() - b.w.startDate.getTime())
        .map(({ w, phaseOrdinal }) => ({
            phaseOrdinal,
            startDate: toIsoDate(w.startDate),
            endDate: toIsoDate(w.endDate),
            inHorizonDays: w.inHorizonDays,
            isCutback: w.isCutback,
            isTaper: w.isTaper,
            volumeTarget: w.volumeTarget,
            volumeUnit: w.volumeUnit,
            strengthSessionTarget: w.strengthSessionTarget,
            generation: w.generation,
            pulled: w.aiRequestId != null,
            timeTrialDistanceM: w.timeTrialDistanceM,
        }));
    const availability = plan.availability as unknown as AvailabilityMap;
    return recut({
        today,
        endDate: toIsoDate(plan.endDate),
        phases,
        weeks,
        change,
        goal: { isRace: plan.goal.goalType === 'RACE' && goalDate != null, distanceM: plan.goal.targetDistanceM },
        recentVolume: recentRunningVolume(context.activities, today),
        runsPerWeek: WEEKDAYS.filter((d) => availability[d]).length,
        anchorPresent: anchorFromContext(context, [], plan.goal.targetDistanceM, today) != null,
    });
}

/**
 * Replaces every week from `relayFrom` with the new tail. Kept phases end at the last kept week; a
 * first new phase that continues the last kept one (same key and school) extends it. A race goal's
 * date moves with the plan's end.
 */
export async function applyRecut(plan: ActivePlan, result: RecutPlan): Promise<void> {
    const userId = plan.userId;
    const relayFrom = asDate(result.relayFrom);
    const kept = plan.phases
        .map((p) => ({ phase: p, weeks: p.weeks.filter((w) => w.startDate < relayFrom) }))
        .filter((k) => k.weeks.length > 0);
    const last = kept[kept.length - 1];
    const lastWeekEnd = (weeks: { endDate: Date }[]) =>
        weeks.reduce((end, w) => (w.endDate > end ? w.endDate : end), weeks[0].endDate);
    const [first, ...rest] = result.phases;
    const continues = last && first.key === last.phase.key && first.school === last.phase.school;
    const nextOrdinal = Math.max(...kept.map((k) => k.phase.ordinal)) + 1;
    const weeksOf = (ordinal: number) =>
        result.weeks.filter((w) => w.phaseOrdinal === ordinal).map((w) => laidWeekRow(userId, w, result.timeTrial));

    await db.$transaction(async (tx) => {
        // Only weeks never pulled may go; a week pulled since the read aborts the recut.
        const doomed = plan.phases.flatMap((p) => p.weeks).filter((w) => w.startDate >= relayFrom);
        const deleted = await tx.planWeek.deleteMany({
            where: { id: { in: doomed.map((w) => w.id) }, generation: 'PENDING', aiRequestId: null },
        });
        if (deleted.count !== doomed.length) throw new RecutConflictError();

        const keptIds = new Set(kept.map((k) => k.phase.id));
        await tx.planPhase.deleteMany({ where: { planId: plan.id, id: { notIn: [...keptIds] } } });
        for (const k of kept) {
            if (k === last && continues) continue;
            await tx.planPhase.update({ where: { id: k.phase.id }, data: { endDate: lastWeekEnd(k.weeks) } });
        }
        if (continues) {
            await tx.planPhase.update({
                where: { id: last.phase.id },
                data: { endDate: asDate(first.endDate), weeks: { create: weeksOf(first.ordinal) } },
            });
        }
        const created = continues ? rest : result.phases;
        for (const [i, p] of created.entries()) {
            await tx.planPhase.create({
                data: {
                    planId: plan.id,
                    key: p.key,
                    name: p.name,
                    ordinal: nextOrdinal + i,
                    startDate: asDate(p.startDate),
                    endDate: asDate(p.endDate),
                    intent: p.intent,
                    source: p.source,
                    school: p.school,
                    volumeUnit: p.volumeUnit,
                    weeks: { create: weeksOf(p.ordinal) },
                },
            });
        }

        await tx.plan.update({ where: { id: plan.id }, data: { endDate: asDate(result.endDate) } });
        if (plan.goal.targetEventDate && toIsoDate(plan.goal.targetEventDate) !== result.endDate) {
            await tx.runningGoal.update({
                where: { id: plan.goalId },
                data: { targetEventDate: asDate(result.endDate) },
            });
        }
    });
}

export type { RecutResult };
