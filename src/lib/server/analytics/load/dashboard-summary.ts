import { toIsoDate } from '$lib/utils/iso-week';
import {
    ACUTE_DAYS,
    CHRONIC_DAYS,
    buildDailyLoadMap,
    computeAcwr,
    computeAverageDailyLoad,
    enumerateDates,
    hasSufficientHistory,
    type DailyLoadEntry,
} from './acwr';
import { computeMonotony } from './monotony';
import { interpretAcwr, interpretMonotony, type AcwrStatus } from './interpret';

export interface DashboardSummaryActivity {
    /** ISO timestamp string. */
    startTime: string;
    distanceM: number | null;
    trimpLoad: number | null;
}

export interface DashboardSummary {
    acwr: number;
    loadStatus: AcwrStatus;
    sevenDayDistanceM: number;
    sessions7d: number;
    monotony: number;
    monotonyIsHigh: boolean;
    hasActivities: boolean;
    /** True once the earliest activity is at least 28 days old, so the chronic load (and ACWR) is meaningful. */
    hasSufficientHistory: boolean;
}

/**
 * @param activities Activities within the rolling load window (28d chronic + headroom).
 * @param earliestActivityAt Start time of the user's *first ever* activity, or null if
 *   they have none. Passed in rather than derived from `activities` because the caller
 *   queries a bounded window: the oldest row in that window says nothing about how long
 *   the athlete has been training, which is what `hasSufficientHistory` reports.
 */
export function computeDashboardSummary(
    activities: DashboardSummaryActivity[],
    asOf: Date,
    earliestActivityAt: Date | null,
): DashboardSummary {
    const entries: DailyLoadEntry[] = activities.map((a) => ({
        date: toIsoDate(new Date(a.startTime)),
        load: a.trimpLoad ?? 0,
    }));
    const dailyLoads = buildDailyLoadMap(entries);

    const acute = computeAverageDailyLoad(dailyLoads, asOf, ACUTE_DAYS);
    const chronic = computeAverageDailyLoad(dailyLoads, asOf, CHRONIC_DAYS);
    const acwr = computeAcwr(acute, chronic);
    const monotonyRaw = computeMonotony(dailyLoads, asOf, ACUTE_DAYS);

    const last7 = new Set(enumerateDates(asOf, ACUTE_DAYS));
    let sevenDayDistanceM = 0;
    let sessions7d = 0;
    for (const a of activities) {
        if (last7.has(toIsoDate(new Date(a.startTime)))) {
            sevenDayDistanceM += a.distanceM ?? 0;
            sessions7d += 1;
        }
    }

    return {
        acwr: round(acwr, 2),
        loadStatus: interpretAcwr(acwr).status,
        sevenDayDistanceM,
        sessions7d,
        monotony: isFinite(monotonyRaw) ? round(monotonyRaw, 2) : 0,
        monotonyIsHigh: interpretMonotony(monotonyRaw).isHigh,
        hasActivities: activities.length > 0,
        hasSufficientHistory: hasSufficientHistory(earliestActivityAt, asOf),
    };
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}
