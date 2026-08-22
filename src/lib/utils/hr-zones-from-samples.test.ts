import { describe, it, expect } from 'vitest';
import { hrZoneSecondsFromSamples } from './hr-zones-from-samples';
import type { ActivitySample } from '$lib/server/garmin/fetch-activity-detail';

function s(timestampSec: number, heartRate: number): ActivitySample {
    return { timestampSec, heartRate, speed: null, elevationM: null, cadence: null, power: null };
}

describe('hrZoneSecondsFromSamples', () => {
    const bounds = [100, 120, 140, 160, 180]; // zone lower bounds

    it('buckets seconds by the zone each sample falls in', () => {
        const samples = [s(0, 110), s(30, 110), s(60, 150), s(90, 150)];
        const zones = hrZoneSecondsFromSamples(samples, bounds);
        expect(zones?.zone1).toBe(60);
        expect(zones?.zone3).toBe(60);
    });

    it('returns null without bounds or without HR samples', () => {
        expect(hrZoneSecondsFromSamples([s(0, 110)], null)).toBeNull();
        expect(hrZoneSecondsFromSamples([], bounds)).toBeNull();
    });
});
