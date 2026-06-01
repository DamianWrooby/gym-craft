import type { GarminActivity } from '@/models/garmin/activity.model';
import type { MetricsByDay, MetricsByType, MetricsVolume } from './types';
import { addDays } from '$lib/utils/iso-week';

export function computeVolume(activities: GarminActivity[], periodStart: string, periodEnd: string): MetricsVolume {
    const byDayMap = buildDayBuckets(periodStart, periodEnd);
    const byType: Record<string, MetricsByType> = {};
    let totalDistanceM = 0;
    let totalDurationSec = 0;
    let totalCalories = 0;

    for (const activity of activities) {
        const date = activity.startTimeLocal.slice(0, 10);
        const distance = activity.distance ?? 0;
        const duration = activity.duration ?? 0;
        const calories = activity.calories ?? 0;

        totalDistanceM += distance;
        totalDurationSec += duration;
        totalCalories += calories;

        const bucket = byDayMap.get(date);
        if (bucket) {
            bucket.distanceM += distance;
            bucket.durationSec += duration;
        }

        const typeKey = activity.activityType.typeKey;
        const typeBucket = byType[typeKey] ?? { distanceM: 0, durationSec: 0, count: 0 };
        typeBucket.distanceM += distance;
        typeBucket.durationSec += duration;
        typeBucket.count += 1;
        byType[typeKey] = typeBucket;
    }

    return {
        totalDistanceM,
        totalDurationSec,
        totalCalories,
        byDay: Array.from(byDayMap.values()),
        byType,
    };
}

function buildDayBuckets(periodStart: string, periodEnd: string): Map<string, MetricsByDay> {
    const buckets = new Map<string, MetricsByDay>();
    let cursor = periodStart;
    while (cursor <= periodEnd) {
        buckets.set(cursor, { date: cursor, distanceM: 0, durationSec: 0 });
        cursor = addDays(cursor, 1);
    }
    return buckets;
}
