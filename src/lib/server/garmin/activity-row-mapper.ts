import type { Activity } from '@prisma/client';

export interface ActivityListItem {
    id: string;
    garminActivityId: string;
    activityType: string;
    activityName: string | null;
    startTime: string;
    durationSec: number;
    distanceM: number | null;
    calories: number | null;
    averageHr: number | null;
    averageSpeed: number | null;
    elevationGainM: number | null;
    trimpLoad: number | null;
}

export function toActivityListItem(row: Activity): ActivityListItem {
    return {
        id: row.id,
        garminActivityId: row.garminActivityId.toString(),
        activityType: row.activityType,
        activityName: row.activityName,
        startTime: row.startTime.toISOString(),
        durationSec: row.durationSec,
        distanceM: row.distanceM,
        calories: row.calories,
        averageHr: row.averageHr,
        averageSpeed: row.averageSpeed,
        elevationGainM: row.elevationGainM,
        trimpLoad: row.trimpLoad,
    };
}
