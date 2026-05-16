import type { GarminActivity } from '@/models/garmin/activity.model';
import type { CrossTrainingByType, CrossTrainingSummary } from './types';

export function computeCrossTrainingSummary(activities: GarminActivity[]): CrossTrainingSummary {
    const byType: Record<string, CrossTrainingByType> = {};
    let totalCount = 0;
    let totalDurationSec = 0;
    let totalDistanceM = 0;
    let totalCalories = 0;
    let totalVigorousMinutes = 0;
    let totalModerateMinutes = 0;

    for (const activity of activities) {
        const typeKey = activity.activityType?.typeKey ?? 'unknown';
        const duration = activity.duration ?? 0;
        const distance = activity.distance ?? 0;
        const calories = activity.calories ?? 0;
        const vigorous = activity.vigorousIntensityMinutes ?? 0;
        const moderate = activity.moderateIntensityMinutes ?? 0;

        const bucket = byType[typeKey] ?? {
            count: 0,
            durationSec: 0,
            distanceM: 0,
            calories: 0,
            vigorousMinutes: 0,
            moderateMinutes: 0,
        };
        bucket.count += 1;
        bucket.durationSec += duration;
        bucket.distanceM += distance;
        bucket.calories += calories;
        bucket.vigorousMinutes += vigorous;
        bucket.moderateMinutes += moderate;
        byType[typeKey] = bucket;

        totalCount += 1;
        totalDurationSec += duration;
        totalDistanceM += distance;
        totalCalories += calories;
        totalVigorousMinutes += vigorous;
        totalModerateMinutes += moderate;
    }

    return {
        totals: {
            count: totalCount,
            durationSec: totalDurationSec,
            distanceM: totalDistanceM,
            calories: totalCalories,
            vigorousMinutes: totalVigorousMinutes,
            moderateMinutes: totalModerateMinutes,
        },
        byType,
    };
}
