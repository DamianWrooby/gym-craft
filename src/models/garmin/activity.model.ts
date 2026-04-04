export interface GarminActivity {
    activityId: number;
    activityName: string;
    startTimeLocal: string;
    activityType: {
        typeKey: string;
    };
    distance: number;
    duration: number;
    calories: number;
    averageHR?: number;
    maxHR?: number;
    averageSpeed?: number;
    maxSpeed?: number;
    steps?: number;
    elevationGain?: number;
    elevationLoss?: number;
}

export interface FetchActivitiesParams {
    startDate: string;
    endDate?: string;
    activityType?: string;
    password?: string;
}
