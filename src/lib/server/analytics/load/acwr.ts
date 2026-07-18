import { toIsoDate } from '$lib/utils/iso-week';

export { toIsoDate };

export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;

export interface DailyLoadEntry {
    /** ISO date string (YYYY-MM-DD) in the same timezone used to assign activities to days. */
    date: string;
    load: number;
}

export function buildDailyLoadMap(entries: DailyLoadEntry[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const entry of entries) {
        map.set(entry.date, (map.get(entry.date) ?? 0) + entry.load);
    }
    return map;
}

export function computeAverageDailyLoad(dailyLoads: Map<string, number>, asOf: Date, windowDays: number): number {
    if (windowDays <= 0) return 0;
    const dates = enumerateDates(asOf, windowDays);
    const total = dates.reduce((acc, date) => acc + (dailyLoads.get(date) ?? 0), 0);
    return total / windowDays;
}

export function computeWindowTotalLoad(dailyLoads: Map<string, number>, asOf: Date, windowDays: number): number {
    const dates = enumerateDates(asOf, windowDays);
    return dates.reduce((acc, date) => acc + (dailyLoads.get(date) ?? 0), 0);
}

export function computeAcwr(acuteLoad: number, chronicLoad: number): number {
    if (chronicLoad <= 0) return 0;
    return acuteLoad / chronicLoad;
}

export function daysOfHistory(earliestStart: Date | number | null, asOf: Date): number {
    const ms = earliestStart instanceof Date ? earliestStart.getTime() : earliestStart;
    if (ms == null || !isFinite(ms)) return 0;
    return Math.floor((asOf.getTime() - ms) / 86_400_000);
}

/** ACWR needs a full chronic window of history before the ratio is meaningful. */
export function hasSufficientHistory(earliestStart: Date | number | null, asOf: Date): boolean {
    return daysOfHistory(earliestStart, asOf) >= CHRONIC_DAYS;
}

export function enumerateDates(asOf: Date, windowDays: number): string[] {
    const dates: string[] = [];
    const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
    for (let i = windowDays - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() - i);
        dates.push(toIsoDate(d));
    }
    return dates;
}
