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

export function isRunningTypeKey(typeKey: string | null | undefined): boolean {
    if (!typeKey) return false;
    return RUNNING_TYPE_KEYS.has(typeKey) || typeKey.includes('running');
}

const WALKING_TYPE_KEYS = new Set(['walking', 'casual_walking', 'speed_walking']);

/**
 * Walking is not training: Garmin's Move IQ auto-creates walk records the athlete never
 * started (see CONTEXT.md "Training activity"). Hiking is training and is NOT matched here.
 */
export function isWalkingTypeKey(typeKey: string | null | undefined): boolean {
    if (!typeKey) return false;
    return WALKING_TYPE_KEYS.has(typeKey) || typeKey.includes('walking');
}

/**
 * THE single flip-point for which activities may use the "Ask AI" coach.
 * Today the coach persona is running-specific (see explain-activity.ts SYSTEM_PROMPT),
 * so eligibility == running modality. The product intends to widen this to other
 * modalities later — when that happens, change ONLY this function (and adapt the coach
 * persona prompt per modality). Both the UI panel guard and the API guard call this,
 * so there is exactly one place to edit. Do NOT inline `isRunningTypeKey` at the guards.
 */
export function activityTypeSupportsAiCoach(typeKey: string | null | undefined): boolean {
    return isRunningTypeKey(typeKey);
}

export function isRunningActivity(activity: GarminActivity): boolean {
    return isRunningTypeKey(activity.activityType?.typeKey);
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
