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
import { classifyModality, type ActivityModality } from '$lib/utils/activity-type';

export interface DashboardSummaryActivity {
    /** ISO timestamp string. */
    startTime: string;
    activityType: string;
    distanceM: number | null;
    trimpLoad: number | null;
}

export interface ModalityDistance {
    modality: ActivityModality;
    /** Distance in the last 7 days — the figure a tile displays. */
    sevenDayDistanceM: number;
    /**
     * Distance over the last 28 days — the figure that decides whether a tile exists at all.
     * Bounded here rather than left to the caller's query: that query spans 35 days (chronic plus
     * a week of headroom for timezone edges), and letting the headroom leak in would keep a tile
     * on screen for a week after the sport stopped counting toward chronic load.
     */
    chronicDistanceM: number;
}

export interface DashboardSummary {
    acwr: number;
    loadStatus: AcwrStatus;
    /** Per-modality: a kilometre of swimming is not a kilometre of running, so these never sum. */
    distanceByModality: ModalityDistance[];
    sessions7d: number;
    monotony: number;
    monotonyIsHigh: boolean;
    hasActivities: boolean;
    /** True once the earliest activity is at least 28 days old, so the chronic load (and ACWR) is meaningful. */
    hasSufficientHistory: boolean;
}

/** Running always renders, so it leads. The rest keep a stable order as they appear and disappear. */
const MODALITY_ORDER: ActivityModality[] = ['running', 'cycling', 'swimming', 'other'];

/**
 * Load, monotony and sessions span *every* training modality — a hard ride is systemic stress
 * whether or not it was a run. Only distance is split per modality, because distances across
 * modalities are not commensurable. See docs/adr/0003-training-load-scope-and-modalities.md.
 *
 * @param activities Training activities within the rolling load window (28d chronic + headroom).
 *   The caller is expected to have already excluded non-training rows (walking).
 * @param earliestActivityAt Start time of the user's *first ever* training activity, or null if
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
    const last28 = new Set(enumerateDates(asOf, CHRONIC_DAYS));
    const sevenDayMetresByModality = new Map<ActivityModality, number>();
    const chronicMetresByModality = new Map<ActivityModality, number>();
    let sessions7d = 0;
    for (const a of activities) {
        const modality = classifyModality(a.activityType);
        const distance = a.distanceM ?? 0;
        const date = toIsoDate(new Date(a.startTime));
        if (last28.has(date)) {
            chronicMetresByModality.set(modality, (chronicMetresByModality.get(modality) ?? 0) + distance);
        }
        if (last7.has(date)) {
            sevenDayMetresByModality.set(modality, (sevenDayMetresByModality.get(modality) ?? 0) + distance);
            sessions7d += 1;
        }
    }

    return {
        acwr: round(acwr, 2),
        loadStatus: interpretAcwr(acwr).status,
        distanceByModality: MODALITY_ORDER.map((modality) => ({
            modality,
            sevenDayDistanceM: sevenDayMetresByModality.get(modality) ?? 0,
            chronicDistanceM: chronicMetresByModality.get(modality) ?? 0,
        })),
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
