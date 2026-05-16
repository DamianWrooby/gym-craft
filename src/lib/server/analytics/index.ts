import type { GarminActivity } from '@/models/garmin/activity.model';
import type { MetricsBundle } from './types';
import { computeVolume } from './volume';
import { computeIntensity } from './intensity';
import { computeEfficiency } from './efficiency';
import { computeDeltas } from './deltas';
import { computeCrossTrainingSummary } from './cross-training';

export interface ComputeWeeklyMetricsParams {
    periodStart: string;
    periodEnd: string;
    /** Running-only activities. These drive volume/intensity/efficiency/deltas and the charts. */
    activities: GarminActivity[];
    /** Running-only previous week activities — used for week-over-week deltas. */
    previousWeekActivities?: GarminActivity[] | null;
    /** Non-running activities in the current week — summarized for LLM context only. */
    crossTrainingActivities?: GarminActivity[];
    hasHrZoneBounds: boolean;
}

export function computeWeeklyMetrics(params: ComputeWeeklyMetricsParams): MetricsBundle {
    const {
        periodStart,
        periodEnd,
        activities,
        previousWeekActivities = null,
        crossTrainingActivities = [],
        hasHrZoneBounds,
    } = params;

    const volume = computeVolume(activities, periodStart, periodEnd);
    const intensity = computeIntensity(activities);
    const efficiency = computeEfficiency(activities);
    const deltas = computeDeltas({ volume, intensity, efficiency }, previousWeekActivities);
    const crossTraining = computeCrossTrainingSummary(crossTrainingActivities);

    const noRunningActivities = activities.length === 0;
    const noActivities = noRunningActivities && crossTraining.totals.count === 0;

    return {
        period: { start: periodStart, end: periodEnd },
        volume,
        intensity,
        efficiency,
        deltas,
        crossTraining,
        flags: {
            noActivities,
            noRunningActivities,
            missingHRZones: intensity.hrZoneSeconds === null,
            missingHrZoneBounds: !hasHrZoneBounds,
        },
    };
}

export type { MetricsBundle } from './types';
