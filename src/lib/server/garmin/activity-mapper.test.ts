import { describe, it, expect } from 'vitest';
import { mapGarminActivity, mapGarminActivities } from './activity-mapper';
import type { GarminActivityRaw } from '@/models/garmin/activity.model';

const fullRaw: GarminActivityRaw = {
    activityId: 22855329750,
    activityName: 'Bydgoszcz Other',
    activityType: {
        typeKey: 'other',
        parentTypeId: 17,
        isHidden: false,
    },
    locationName: 'Bydgoszcz',
    startTimeLocal: '2026-05-12 15:17:41',
    startTimeGMT: '2026-05-12 13:17:41',
    beginTimestamp: 1778591861000,
    duration: 4391.64,
    movingDuration: 642,
    distance: 1474.69,
    steps: 1310,
    calories: 297,
    averageHR: 95,
    maxHR: 144,
    hrTimeInZone_1: 1319.526,
    hrTimeInZone_2: 113.999,
    hrTimeInZone_3: 75,
    hrTimeInZone_4: 0,
    hrTimeInZone_5: 0,
    moderateIntensityMinutes: 28,
    vigorousIntensityMinutes: 3,
    averageSpeed: 0.336,
    maxSpeed: 6.699,
    averageRunningCadenceInStepsPerMinute: 10.84,
    maxRunningCadenceInStepsPerMinute: 170,
    avgStrideLength: 87.71,
    elevationGain: 204.18,
    elevationLoss: 198.89,
};

describe('mapGarminActivity', () => {
    it('maps every analytics-relevant field from the full payload', () => {
        const mapped = mapGarminActivity(fullRaw);

        expect(mapped).toEqual({
            activityId: 22855329750,
            activityName: 'Bydgoszcz Other',
            activityType: { typeKey: 'other' },
            locationName: 'Bydgoszcz',
            startTimeLocal: '2026-05-12 15:17:41',
            startTimeGMT: '2026-05-12 13:17:41',
            beginTimestamp: 1778591861000,
            duration: 4391.64,
            movingDuration: 642,
            distance: 1474.69,
            steps: 1310,
            calories: 297,
            averageHR: 95,
            maxHR: 144,
            hrZones: { zone1: 1319.526, zone2: 113.999, zone3: 75, zone4: 0, zone5: 0 },
            moderateIntensityMinutes: 28,
            vigorousIntensityMinutes: 3,
            averageSpeed: 0.336,
            maxSpeed: 6.699,
            averageCadence: 10.84,
            maxCadence: 170,
            avgStrideLength: 87.71,
            elevationGain: 204.18,
            elevationLoss: 198.89,
        });
    });

    it('flattens activityType to only typeKey, dropping extra fields', () => {
        const mapped = mapGarminActivity(fullRaw);
        expect(mapped.activityType).toEqual({ typeKey: 'other' });
        expect(Object.keys(mapped.activityType)).toHaveLength(1);
    });

    it('returns hrZones undefined when hrTimeInZone_1 is absent', () => {
        const noZones: GarminActivityRaw = { ...fullRaw };
        delete noZones.hrTimeInZone_1;
        delete noZones.hrTimeInZone_2;
        delete noZones.hrTimeInZone_3;
        delete noZones.hrTimeInZone_4;
        delete noZones.hrTimeInZone_5;

        const mapped = mapGarminActivity(noZones);

        expect(mapped.hrZones).toBeUndefined();
    });

    it('defaults missing higher zones to 0 when zone_1 is present', () => {
        const onlyZone1: GarminActivityRaw = { ...fullRaw };
        delete onlyZone1.hrTimeInZone_2;
        delete onlyZone1.hrTimeInZone_3;
        delete onlyZone1.hrTimeInZone_4;
        delete onlyZone1.hrTimeInZone_5;

        const mapped = mapGarminActivity(onlyZone1);

        expect(mapped.hrZones).toEqual({ zone1: 1319.526, zone2: 0, zone3: 0, zone4: 0, zone5: 0 });
    });

    it('treats hrTimeInZone_1 === 0 as present (still produces hrZones)', () => {
        const zeroZone1: GarminActivityRaw = { ...fullRaw, hrTimeInZone_1: 0 };
        const mapped = mapGarminActivity(zeroZone1);
        expect(mapped.hrZones).toBeDefined();
        expect(mapped.hrZones?.zone1).toBe(0);
    });

    it('passes through missing optional fields as undefined', () => {
        const minimal: GarminActivityRaw = {
            activityId: 1,
            activityName: 'Minimal',
            activityType: { typeKey: 'running' },
            startTimeLocal: '2026-05-12 15:17:41',
            startTimeGMT: '2026-05-12 13:17:41',
            beginTimestamp: 1778591861000,
            duration: 1800,
            distance: 5000,
            calories: 250,
        };

        const mapped = mapGarminActivity(minimal);

        expect(mapped.locationName).toBeUndefined();
        expect(mapped.movingDuration).toBeUndefined();
        expect(mapped.steps).toBeUndefined();
        expect(mapped.averageHR).toBeUndefined();
        expect(mapped.maxHR).toBeUndefined();
        expect(mapped.hrZones).toBeUndefined();
        expect(mapped.moderateIntensityMinutes).toBeUndefined();
        expect(mapped.vigorousIntensityMinutes).toBeUndefined();
        expect(mapped.averageSpeed).toBeUndefined();
        expect(mapped.maxSpeed).toBeUndefined();
        expect(mapped.averageCadence).toBeUndefined();
        expect(mapped.maxCadence).toBeUndefined();
        expect(mapped.avgStrideLength).toBeUndefined();
        expect(mapped.elevationGain).toBeUndefined();
        expect(mapped.elevationLoss).toBeUndefined();
    });

    it('renames Garmin cadence fields to camelCase', () => {
        const mapped = mapGarminActivity(fullRaw);
        expect(mapped.averageCadence).toBe(10.84);
        expect(mapped.maxCadence).toBe(170);
    });
});

describe('mapGarminActivities', () => {
    it('maps a list preserving order', () => {
        const list: GarminActivityRaw[] = [
            { ...fullRaw, activityId: 1 },
            { ...fullRaw, activityId: 2 },
            { ...fullRaw, activityId: 3 },
        ];
        const mapped = mapGarminActivities(list);
        expect(mapped.map((a) => a.activityId)).toEqual([1, 2, 3]);
    });

    it('returns an empty array for empty input', () => {
        expect(mapGarminActivities([])).toEqual([]);
    });
});
