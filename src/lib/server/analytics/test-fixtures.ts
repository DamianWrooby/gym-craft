import type { GarminActivity } from '@/models/garmin/activity.model';

export function makeActivity(overrides: Partial<GarminActivity> = {}): GarminActivity {
    return {
        activityId: 1,
        activityName: 'Test',
        activityType: { typeKey: 'running' },
        startTimeLocal: '2026-05-11 09:00:00',
        startTimeGMT: '2026-05-11 07:00:00',
        beginTimestamp: Date.parse('2026-05-11T07:00:00Z'),
        duration: 1800,
        distance: 5000,
        calories: 300,
        averageHR: 140,
        maxHR: 165,
        hrZones: { zone1: 600, zone2: 900, zone3: 300, zone4: 0, zone5: 0 },
        moderateIntensityMinutes: 20,
        vigorousIntensityMinutes: 5,
        averageSpeed: 2.78,
        elevationGain: 25,
        ...overrides,
    };
}
