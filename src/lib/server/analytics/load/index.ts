import { db } from '$lib/database';
import type { TrimpProfile } from './trimp';
import { ensureTrimpLoads } from './ensure-trimp';
import {
    ACUTE_DAYS,
    CHRONIC_DAYS,
    buildDailyLoadMap,
    computeAcwr,
    computeAverageDailyLoad,
    computeWindowTotalLoad,
    hasSufficientHistory,
    type DailyLoadEntry,
} from './acwr';
import { computeMonotony, computeStrain } from './monotony';
import { interpretAcwr, interpretMonotony } from './interpret';
import { toIsoDate } from '$lib/utils/iso-week';
import type { MetricsLoadProfile } from '../types';

const PREVIOUS_WEEK_OFFSET = 7;

export async function computeLoadProfile(
    userId: string,
    asOf: Date,
    profile: TrimpProfile,
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

    const withTrimp = await ensureTrimpLoads(activities, profile);
    const entries: DailyLoadEntry[] = withTrimp.map((activity) => ({
        date: toIsoDate(activity.startTime),
        load: activity.trimpLoad,
    }));

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
        hasSufficientHistory: hasSufficientHistory(activities[0]?.startTime ?? null, asOf),
    };
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}
