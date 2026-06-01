import type { GarminActivity, GarminActivityHrZones, GarminActivityRaw } from '@/models/garmin/activity.model';

export function mapGarminActivity(raw: GarminActivityRaw): GarminActivity {
    return {
        activityId: raw.activityId,
        activityName: raw.activityName,
        activityType: { typeKey: raw.activityType.typeKey },
        locationName: raw.locationName,
        startTimeLocal: raw.startTimeLocal,
        startTimeGMT: raw.startTimeGMT,
        beginTimestamp: raw.beginTimestamp,
        duration: raw.duration,
        movingDuration: raw.movingDuration,
        distance: raw.distance,
        steps: raw.steps,
        calories: raw.calories,
        averageHR: raw.averageHR,
        maxHR: raw.maxHR,
        hrZones: extractHrZones(raw),
        moderateIntensityMinutes: raw.moderateIntensityMinutes,
        vigorousIntensityMinutes: raw.vigorousIntensityMinutes,
        averageSpeed: raw.averageSpeed,
        maxSpeed: raw.maxSpeed,
        averageCadence: raw.averageRunningCadenceInStepsPerMinute,
        maxCadence: raw.maxRunningCadenceInStepsPerMinute,
        avgStrideLength: raw.avgStrideLength,
        elevationGain: raw.elevationGain,
        elevationLoss: raw.elevationLoss,
    };
}

export function mapGarminActivities(rawList: GarminActivityRaw[]): GarminActivity[] {
    return rawList.map(mapGarminActivity);
}

function extractHrZones(raw: GarminActivityRaw): GarminActivityHrZones | undefined {
    if (raw.hrTimeInZone_1 == null) return undefined;
    return {
        zone1: raw.hrTimeInZone_1,
        zone2: raw.hrTimeInZone_2 ?? 0,
        zone3: raw.hrTimeInZone_3 ?? 0,
        zone4: raw.hrTimeInZone_4 ?? 0,
        zone5: raw.hrTimeInZone_5 ?? 0,
    };
}
