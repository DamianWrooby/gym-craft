// Strikes a plan week's recovery budget from the athlete's stored activities (ADR 0011). Read once
// at the pull (or at plan creation for week 1) and frozen on the week; it never moves as runs sync.
import { db } from '$lib/database';
import { addDays, toIsoDate } from '$lib/utils/iso-week';
import {
    CHRONIC_DAYS,
    buildDailyLoadMap,
    computeAverageDailyLoad,
    daysOfHistory,
} from '$lib/server/analytics/load/acwr';
import { fallbackShare, strikeBudget } from '$lib/planner/core/budget';
import type { BudgetAbsence } from '@prisma/client';

export interface HistoryActivity {
    startTime: Date;
    trimpLoad: number | null;
    loadMethod: string | null;
}

export interface StruckBudget {
    recoveryBudget: number | null;
    chronicLoad: number | null;
    chronicFallbackShare: number | null;
    budgetAbsence: BudgetAbsence | null;
    budgetStruckAt: Date;
}

/** Pure: the 28-day window, the first-ever activity, and the week's days and outlook. */
export function budgetFromHistory(input: {
    activities: HistoryActivity[];
    earliestActivityAt: Date | null;
    today: string;
    inHorizonDays: number;
    outlookFactor: number;
    /** A linked Garmin account; without one the budget bar is locked, not short of history. */
    hasGarminLink: boolean;
    now: Date;
}): StruckBudget {
    const asOf = new Date(`${input.today}T00:00:00Z`);
    const windowStart = addDays(input.today, -(CHRONIC_DAYS - 1));
    const inWindow = input.activities.filter((a) => {
        const day = toIsoDate(a.startTime);
        return day >= windowStart && day <= input.today;
    });
    const loads = buildDailyLoadMap(inWindow.map((a) => ({ date: toIsoDate(a.startTime), load: a.trimpLoad ?? 0 })));
    const chronicLoad = Math.round(computeAverageDailyLoad(loads, asOf, CHRONIC_DAYS) * 10) / 10;
    const recoveryBudget = strikeBudget({
        chronicLoad,
        historyDays: daysOfHistory(input.earliestActivityAt, asOf),
        inHorizonDays: input.inHorizonDays,
        outlookFactor: input.outlookFactor,
    });

    let budgetAbsence: BudgetAbsence | null = null;
    if (recoveryBudget == null) budgetAbsence = input.hasGarminLink ? 'SHORT_HISTORY' : 'NO_TRACKED_ACTIVITY';
    return {
        recoveryBudget,
        chronicLoad: input.earliestActivityAt ? chronicLoad : null,
        chronicFallbackShare: input.earliestActivityAt
            ? fallbackShare(inWindow.map((a) => ({ load: a.trimpLoad ?? 0, method: a.loadMethod })))
            : null,
        budgetAbsence,
        budgetStruckAt: input.now,
    };
}

export async function strikeWeekBudget(
    userId: string,
    today: string,
    inHorizonDays: number,
    outlookFactor: number,
): Promise<StruckBudget> {
    const [garmin, earliest, activities] = await Promise.all([
        db.garminData.findUnique({ where: { userId }, select: { id: true } }),
        db.activity.findFirst({ where: { userId }, orderBy: { startTime: 'asc' }, select: { startTime: true } }),
        db.activity.findMany({
            where: { userId, startTime: { gte: new Date(`${addDays(today, -CHRONIC_DAYS)}T00:00:00Z`) } },
            select: { startTime: true, trimpLoad: true, loadMethod: true },
        }),
    ]);
    return budgetFromHistory({
        activities,
        earliestActivityAt: earliest?.startTime ?? null,
        today,
        inHorizonDays,
        outlookFactor,
        hasGarminLink: garmin != null,
        now: new Date(),
    });
}
