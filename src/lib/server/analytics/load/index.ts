import { db } from '$lib/database';
import { computeTrimp, type TrimpSex } from './trimp';
import {
    buildDailyLoadMap,
    computeAcwr,
    computeAverageDailyLoad,
    computeWindowTotalLoad,
    type DailyLoadEntry,
} from './acwr';
import { computeMonotony, computeStrain } from './monotony';
import { interpretAcwr, interpretMonotony } from './interpret';
import { toIsoDate } from '$lib/utils/iso-week';
import { hrZoneSecondsFromRow } from '$lib/utils/hr-zones';
import type { MetricsLoadProfile } from '../types';

const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28;
const PREVIOUS_WEEK_OFFSET = 7;

export async function computeLoadProfile(
    userId: string,
    asOf: Date,
    profile: { restingHR: number | null; maxHR: number | null; sex?: TrimpSex | null },
): Promise<MetricsLoadProfile> {
    const windowStart = new Date(asOf);
    windowStart.setUTCDate(windowStart.getUTCDate() - (CHRONIC_DAYS + PREVIOUS_WEEK_OFFSET - 1));
    const windowEnd = new Date(asOf);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

    const activities = await db.activity.findMany({
        where: { userId, startTime: { gte: windowStart, lt: windowEnd } },
        orderBy: { startTime: 'asc' },
        select: {
            id: true,
            startTime: true,
            durationSec: true,
            averageHr: true,
            hrZone1Sec: true,
            hrZone2Sec: true,
            hrZone3Sec: true,
            hrZone4Sec: true,
            hrZone5Sec: true,
            trimpLoad: true,
        },
    });

    const entries: DailyLoadEntry[] = [];
    const trimpUpdates: { id: string; trimpLoad: number }[] = [];

    for (const activity of activities) {
        let trimp = activity.trimpLoad;
        if (trimp == null) {
            trimp = computeTrimp({
                durationSec: activity.durationSec,
                hrZoneSeconds: hrZoneSecondsFromRow(activity),
                averageHr: activity.averageHr ?? null,
                restingHr: profile.restingHR,
                maxHr: profile.maxHR,
                sex: profile.sex ?? 'male',
            });
            trimpUpdates.push({ id: activity.id, trimpLoad: trimp });
        }
        entries.push({ date: toIsoDate(activity.startTime), load: trimp });
    }

    if (trimpUpdates.length > 0) {
        await db.$transaction(
            trimpUpdates.map((u) =>
                db.activity.update({
                    where: { id: u.id },
                    data: { trimpLoad: u.trimpLoad },
                }),
            ),
        );
    }

    const dailyLoads = buildDailyLoadMap(entries);

    const acute = computeAverageDailyLoad(dailyLoads, asOf, ACUTE_DAYS);
    const chronic = computeAverageDailyLoad(dailyLoads, asOf, CHRONIC_DAYS);
    const acwr = computeAcwr(acute, chronic);
    const weeklyTotalLoad = computeWindowTotalLoad(dailyLoads, asOf, ACUTE_DAYS);

    const previousWeekAsOf = new Date(asOf);
    previousWeekAsOf.setUTCDate(previousWeekAsOf.getUTCDate() - PREVIOUS_WEEK_OFFSET);
    const previousWeekTotalLoad = computeWindowTotalLoad(dailyLoads, previousWeekAsOf, ACUTE_DAYS);

    const weekOverWeekLoadChangePct =
        previousWeekTotalLoad > 0 ? ((weeklyTotalLoad - previousWeekTotalLoad) / previousWeekTotalLoad) * 100 : null;

    const monotony = computeMonotony(dailyLoads, asOf, ACUTE_DAYS);
    const strain = computeStrain(weeklyTotalLoad, monotony);

    const acwrInterpretation = interpretAcwr(acwr);
    const monotonyInterpretation = interpretMonotony(monotony);

    const earliestActivityDate = activities[0]?.startTime ?? null;
    const daysOfHistory = earliestActivityDate
        ? Math.floor((asOf.getTime() - earliestActivityDate.getTime()) / 86_400_000)
        : 0;

    return {
        asOf: toIsoDate(asOf),
        acute7d: round(acute, 1),
        chronic28d: round(chronic, 1),
        acwr: round(acwr, 2),
        acwrStatus: acwrInterpretation.status,
        acwrNarrative: acwrInterpretation.narrative,
        monotony: isFinite(monotony) ? round(monotony, 2) : 0,
        strain: round(strain, 1),
        weeklyTotalLoad: round(weeklyTotalLoad, 1),
        previousWeekTotalLoad: previousWeekTotalLoad > 0 ? round(previousWeekTotalLoad, 1) : null,
        weekOverWeekLoadChangePct: weekOverWeekLoadChangePct != null ? round(weekOverWeekLoadChangePct, 1) : null,
        monotonyIsHigh: monotonyInterpretation.isHigh,
        monotonyNarrative: monotonyInterpretation.narrative,
        activitiesConsidered: activities.length,
        hasSufficientHistory: daysOfHistory >= CHRONIC_DAYS,
    };
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}
