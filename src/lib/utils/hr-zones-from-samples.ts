import type { ActivitySample } from '$lib/server/garmin/fetch-activity-detail';
import type { GarminActivityHrZones } from '@/models/garmin/activity.model';

/**
 * Buckets sample time into the 5 HR zones using the athlete's zone lower bounds
 * (ascending, length 5). Fallback for activities whose stored per-zone seconds are null.
 * Each sample's dwell is the gap to the next sample. Returns null when unusable.
 */
export function hrZoneSecondsFromSamples(
    samples: ActivitySample[],
    zoneLowerBounds: number[] | null,
): GarminActivityHrZones | null {
    if (!zoneLowerBounds || zoneLowerBounds.length !== 5) return null;
    const hr = samples.filter((s) => s.heartRate != null && s.heartRate > 0);
    if (hr.length < 2) return null;

    const zones = [0, 0, 0, 0, 0];
    let prevDwell = 0;
    for (let i = 0; i < hr.length; i++) {
        const dwell = i < hr.length - 1 ? hr[i + 1].timestampSec - hr[i].timestampSec : prevDwell;
        if (dwell <= 0) continue;
        zones[zoneIndex(hr[i].heartRate as number, zoneLowerBounds)] += dwell;
        prevDwell = dwell;
    }
    return { zone1: zones[0], zone2: zones[1], zone3: zones[2], zone4: zones[3], zone5: zones[4] };
}

function zoneIndex(hr: number, bounds: number[]): number {
    let idx = 0;
    for (let z = 0; z < bounds.length; z++) {
        if (hr >= bounds[z]) idx = z;
    }
    return idx;
}
