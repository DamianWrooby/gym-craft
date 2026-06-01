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

export function isRunningActivity(activity: GarminActivity): boolean {
    const key = activity.activityType?.typeKey;
    if (!key) return false;
    return RUNNING_TYPE_KEYS.has(key) || key.includes('running');
}

export function partitionRunningActivities(activities: GarminActivity[]): {
    running: GarminActivity[];
    crossTraining: GarminActivity[];
} {
    const running: GarminActivity[] = [];
    const crossTraining: GarminActivity[] = [];
    for (const activity of activities) {
        if (isRunningActivity(activity)) running.push(activity);
        else crossTraining.push(activity);
    }
    return { running, crossTraining };
}
