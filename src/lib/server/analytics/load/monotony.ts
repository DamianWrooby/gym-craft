import { enumerateDates } from './acwr';

export function computeDailyLoadsForWindow(dailyLoads: Map<string, number>, asOf: Date, windowDays: number): number[] {
    return enumerateDates(asOf, windowDays).map((date) => dailyLoads.get(date) ?? 0);
}

export function computeMonotony(dailyLoads: Map<string, number>, asOf: Date, windowDays = 7): number {
    const loads = computeDailyLoadsForWindow(dailyLoads, asOf, windowDays);
    if (loads.length === 0) return 0;
    const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
    if (mean === 0) return 0;
    const variance = loads.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / loads.length;
    const stdev = Math.sqrt(variance);
    if (stdev === 0) return loads.every((v) => v === 0) ? 0 : Infinity;
    return mean / stdev;
}

export function computeStrain(weeklyTotalLoad: number, monotony: number): number {
    if (!isFinite(monotony)) return weeklyTotalLoad;
    return weeklyTotalLoad * monotony;
}
