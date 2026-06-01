import type { GarminActivity } from '@/models/garmin/activity.model';
import type { MetricsDeltas, MetricsEfficiency, MetricsIntensity, MetricsVolume } from './types';
import { computeEfficiency } from './efficiency';
import { computeIntensity } from './intensity';

export function computeDeltas(
    current: { volume: MetricsVolume; intensity: MetricsIntensity; efficiency: MetricsEfficiency },
    previousWeekActivities: GarminActivity[] | null,
): MetricsDeltas | null {
    if (!previousWeekActivities || previousWeekActivities.length === 0) return null;

    const prevDistance = previousWeekActivities.reduce((sum, a) => sum + (a.distance ?? 0), 0);
    const prevDuration = previousWeekActivities.reduce((sum, a) => sum + (a.duration ?? 0), 0);
    const prevIntensity = computeIntensity(previousWeekActivities);
    const prevEfficiency = computeEfficiency(previousWeekActivities);

    const avgHRDelta =
        current.efficiency.averageHR !== null && prevEfficiency.averageHR !== null
            ? roundTo1(current.efficiency.averageHR - prevEfficiency.averageHR)
            : null;

    return {
        distanceM: roundTo1(current.volume.totalDistanceM - prevDistance),
        durationSec: Math.round(current.volume.totalDurationSec - prevDuration),
        vigorousMinutes: current.intensity.vigorousMinutes - prevIntensity.vigorousMinutes,
        avgHRDelta,
    };
}

function roundTo1(n: number): number {
    return Math.round(n * 10) / 10;
}
