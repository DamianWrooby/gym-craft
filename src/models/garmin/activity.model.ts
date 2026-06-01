export interface GarminActivityHrZones {
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
}

export interface GarminActivity {
    activityId: number;
    activityName: string;
    activityType: {
        typeKey: string;
    };
    locationName?: string;
    startTimeLocal: string;
    startTimeGMT: string;
    beginTimestamp: number;
    duration: number;
    movingDuration?: number;
    distance: number;
    steps?: number;
    calories: number;
    averageHR?: number;
    maxHR?: number;
    hrZones?: GarminActivityHrZones;
    moderateIntensityMinutes?: number;
    vigorousIntensityMinutes?: number;
    averageSpeed?: number;
    maxSpeed?: number;
    averageCadence?: number;
    maxCadence?: number;
    avgStrideLength?: number;
    elevationGain?: number;
    elevationLoss?: number;
}

export interface GarminActivityRaw {
    activityId: number;
    activityName: string;
    activityType: {
        typeKey: string;
        [key: string]: unknown;
    };
    locationName?: string;
    startTimeLocal: string;
    startTimeGMT: string;
    beginTimestamp: number;
    duration: number;
    movingDuration?: number;
    distance: number;
    steps?: number;
    calories: number;
    averageHR?: number;
    maxHR?: number;
    hrTimeInZone_1?: number;
    hrTimeInZone_2?: number;
    hrTimeInZone_3?: number;
    hrTimeInZone_4?: number;
    hrTimeInZone_5?: number;
    moderateIntensityMinutes?: number;
    vigorousIntensityMinutes?: number;
    averageSpeed?: number;
    maxSpeed?: number;
    averageRunningCadenceInStepsPerMinute?: number;
    maxRunningCadenceInStepsPerMinute?: number;
    avgStrideLength?: number;
    elevationGain?: number;
    elevationLoss?: number;
    [key: string]: unknown;
}

export interface FetchActivitiesParams {
    startDate: string;
    endDate?: string;
    activityType?: string;
    password?: string;
}
