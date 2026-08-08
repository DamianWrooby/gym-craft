import type { Activity, Prisma } from '@prisma/client';

/**
 * The columns `toActivityListItem` reads — and nothing else. Notably absent is `raw`,
 * the full Garmin payload for the activity: selecting it (which is what Prisma does by
 * default) meant every list query dragged a JSON blob per row across the wire for data
 * no list surface renders.
 */
export const activityListSelect = {
    id: true,
    garminActivityId: true,
    activityType: true,
    activityName: true,
    startTime: true,
    durationSec: true,
    distanceM: true,
    calories: true,
    averageHr: true,
    averageSpeed: true,
    elevationGainM: true,
    trimpLoad: true,
} satisfies Prisma.ActivitySelect;

export type ActivityListRow = Pick<Activity, keyof typeof activityListSelect>;

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

export function toActivityListItem(row: ActivityListRow): ActivityListItem {
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
