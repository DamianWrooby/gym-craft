import type { GarminActivity } from '@/models/garmin/activity.model';

const RUNNING_TYPE_KEYS = new Set([
    'running',
    'treadmill_running',
    'trail_running',
    'track_running',
    'indoor_running',
    'street_running',
    'virtual_run',
    'ultra_run',
    'obstacle_run',
]);

const CYCLING_TYPE_KEYS = new Set([
    'cycling',
    'road_biking',
    'mountain_biking',
    'gravel_cycling',
    'indoor_cycling',
    'virtual_ride',
    'cyclocross',
    'downhill_biking',
    'recumbent_cycling',
    'track_cycling',
]);

const SWIMMING_TYPE_KEYS = new Set(['swimming', 'lap_swimming', 'open_water_swimming']);

/**
 * Garmin's Move IQ auto-creates `walking` activities the athlete never started. Counting them
 * would inflate session counts and — because they rarely carry HR zones — pad the chronic
 * baseline with `durationFallbackTrimp`, which *depresses* ACWR and makes the weekly report
 * recommend training harder. `hiking` is a separate key and is deliberately unaffected.
 * See docs/adr/0003-training-load-scope-and-modalities.md.
 */
/** Mutable and plain `string[]` so Prisma `notIn` filters can consume it without copying. */
export const NON_TRAINING_TYPE_KEYS: string[] = ['walking'];

export function isNonTrainingActivityType(typeKey: string | null | undefined): boolean {
    return typeKey != null && NON_TRAINING_TYPE_KEYS.includes(typeKey);
}

/** Distance-reporting buckets for the running dashboard. Not a general activity taxonomy. */
export type ActivityModality = 'running' | 'cycling' | 'swimming' | 'other';

/**
 * Cycling and swimming match an explicit allowlist with no substring fallback: `swimrun` is not
 * swimming, and `e_bike_ride` is not unassisted cycling. Running keeps its substring fallback
 * because it is the modality this dashboard exists to report, so a missed key costs most there.
 * Composite activities (`multi_sport`) carry one total distance spanning three disciplines and
 * have no honest single bucket, so they fall to `other` — which is already a mixed sum.
 */
export function classifyModality(typeKey: string | null | undefined): ActivityModality {
    if (!typeKey) return 'other';
    if (RUNNING_TYPE_KEYS.has(typeKey) || typeKey.includes('running')) return 'running';
    if (CYCLING_TYPE_KEYS.has(typeKey)) return 'cycling';
    if (SWIMMING_TYPE_KEYS.has(typeKey)) return 'swimming';
    return 'other';
}

export function isRunningActivity(activity: GarminActivity): boolean {
    return classifyModality(activity.activityType?.typeKey) === 'running';
}

export function isNonTrainingActivity(activity: GarminActivity): boolean {
    return isNonTrainingActivityType(activity.activityType?.typeKey);
}

/**
 * Splits into running and cross-training. Non-training activities (walking) are dropped from
 * both: they are neither running volume nor cross-training context.
 */
export function partitionRunningActivities(activities: GarminActivity[]): {
    running: GarminActivity[];
    crossTraining: GarminActivity[];
} {
    const running: GarminActivity[] = [];
    const crossTraining: GarminActivity[] = [];
    for (const activity of activities) {
        if (isNonTrainingActivity(activity)) continue;
        if (isRunningActivity(activity)) running.push(activity);
        else crossTraining.push(activity);
    }
    return { running, crossTraining };
}
