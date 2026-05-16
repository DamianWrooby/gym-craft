import type { GarminActivityHrZones } from '@/models/garmin/activity.model';

export interface MetricsPeriod {
    start: string;
    end: string;
}

export interface MetricsByDay {
    date: string;
    distanceM: number;
    durationSec: number;
}

export interface MetricsByType {
    distanceM: number;
    durationSec: number;
    count: number;
}

export interface MetricsVolume {
    totalDistanceM: number;
    totalDurationSec: number;
    totalCalories: number;
    byDay: MetricsByDay[];
    byType: Record<string, MetricsByType>;
}

export interface MetricsIntensity {
    hrZoneSeconds: GarminActivityHrZones | null;
    hrZonePercents: GarminActivityHrZones | null;
    moderateMinutes: number;
    vigorousMinutes: number;
    polarizationIndex: number | null;
}

export interface MetricsEfficiencyPoint {
    activityId: number;
    avgPaceSecPerKm: number | null;
    avgHR: number | null;
    // Optional context for tooltips. Older saved reports may not have these fields.
    startTimeLocal?: string;
    activityName?: string;
    activityType?: string;
    distanceM?: number;
    durationSec?: number;
}

export interface MetricsEfficiency {
    perActivity: MetricsEfficiencyPoint[];
    averagePaceSecPerKm: number | null;
    averageHR: number | null;
}

export interface MetricsDeltas {
    distanceM: number;
    durationSec: number;
    vigorousMinutes: number;
    avgHRDelta: number | null;
}

export interface MetricsFlags {
    noActivities: boolean;
    noRunningActivities: boolean;
    missingHRZones: boolean;
    missingHrZoneBounds: boolean;
}

export interface CrossTrainingByType {
    count: number;
    durationSec: number;
    distanceM: number;
    calories: number;
    vigorousMinutes: number;
    moderateMinutes: number;
}

export interface CrossTrainingTotals {
    count: number;
    durationSec: number;
    distanceM: number;
    calories: number;
    vigorousMinutes: number;
    moderateMinutes: number;
}

export interface CrossTrainingSummary {
    totals: CrossTrainingTotals;
    byType: Record<string, CrossTrainingByType>;
}

export interface MetricsBundle {
    period: MetricsPeriod;
    volume: MetricsVolume;
    intensity: MetricsIntensity;
    efficiency: MetricsEfficiency;
    deltas: MetricsDeltas | null;
    flags: MetricsFlags;
    crossTraining?: CrossTrainingSummary;
}
