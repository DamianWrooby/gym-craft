import type { GarminActivity } from '@/models/garmin/activity.model';
import type { MetricsEfficiency, MetricsEfficiencyPoint } from './types';

export function computeEfficiency(activities: GarminActivity[]): MetricsEfficiency {
    const perActivity: MetricsEfficiencyPoint[] = activities.map((activity) => ({
        activityId: activity.activityId,
        avgPaceSecPerKm: paceSecPerKm(activity),
        avgHR: activity.averageHR ?? null,
        startTimeLocal: activity.startTimeLocal,
        activityName: activity.activityName,
        activityType: activity.activityType?.typeKey,
        distanceM: activity.distance,
        durationSec:
            activity.movingDuration && activity.movingDuration > 0 ? activity.movingDuration : activity.duration,
    }));

    const validPaces = perActivity.map((p) => p.avgPaceSecPerKm).filter((v): v is number => v !== null);
    const validHrs = perActivity.map((p) => p.avgHR).filter((v): v is number => v !== null);

    return {
        perActivity,
        averagePaceSecPerKm: validPaces.length > 0 ? roundTo1(mean(validPaces)) : null,
        averageHR: validHrs.length > 0 ? roundTo1(mean(validHrs)) : null,
    };
}

function paceSecPerKm(activity: GarminActivity): number | null {
    const distanceM = activity.distance;
    if (!distanceM || distanceM <= 0) return null;

    // Prefer movingDuration for pace (excludes stops); fall back to total duration.
    const seconds =
        activity.movingDuration && activity.movingDuration > 0 ? activity.movingDuration : activity.duration;
    if (!seconds || seconds <= 0) return null;

    return roundTo1((seconds / distanceM) * 1000);
}

function mean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function roundTo1(n: number): number {
    return Math.round(n * 10) / 10;
}
