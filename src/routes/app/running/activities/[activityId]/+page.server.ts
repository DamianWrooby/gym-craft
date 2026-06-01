import { db } from '$lib/database';
import { error, redirect } from '@sveltejs/kit';
import type { ActivitySample, ActivitySplit } from '$lib/server/garmin/fetch-activity-detail';

export const load = async ({ params, locals }: { params: { activityId: string }; locals: App.Locals }) => {
    const userId = locals.user?.id;
    if (!userId) throw redirect(302, '/app/login');

    const rawId = params.activityId;
    const asBigInt = parseBigIntSafe(rawId);

    const activity =
        asBigInt != null
            ? await db.activity.findUnique({
                  where: { userId_garminActivityId: { userId, garminActivityId: asBigInt } },
                  include: { detail: true },
              })
            : await db.activity.findFirst({
                  where: { id: rawId, userId },
                  include: { detail: true },
              });

    if (!activity) {
        throw error(404, 'Activity not found — try syncing your Garmin history first.');
    }

    return {
        activity: {
            id: activity.id,
            garminActivityId: activity.garminActivityId.toString(),
            activityType: activity.activityType,
            activityName: activity.activityName,
            startTime: activity.startTime.toISOString(),
            durationSec: activity.durationSec,
            distanceM: activity.distanceM,
            averageHr: activity.averageHr,
            maxHr: activity.maxHr,
            averageSpeed: activity.averageSpeed,
            averageCadence: activity.averageCadence,
            avgStrideLength: activity.avgStrideLength,
            elevationGainM: activity.elevationGainM,
            elevationLossM: activity.elevationLossM,
            trimpLoad: activity.trimpLoad,
            hrZoneSeconds:
                activity.hrZone1Sec != null
                    ? {
                          zone1: activity.hrZone1Sec ?? 0,
                          zone2: activity.hrZone2Sec ?? 0,
                          zone3: activity.hrZone3Sec ?? 0,
                          zone4: activity.hrZone4Sec ?? 0,
                          zone5: activity.hrZone5Sec ?? 0,
                      }
                    : null,
            detail: activity.detail
                ? {
                      splits: activity.detail.splits as unknown as ActivitySplit[],
                      samples: activity.detail.samples as unknown as ActivitySample[],
                  }
                : null,
        },
    };
};

function parseBigIntSafe(value: string): bigint | null {
    if (!/^\d+$/.test(value)) return null;
    try {
        return BigInt(value);
    } catch {
        return null;
    }
}
