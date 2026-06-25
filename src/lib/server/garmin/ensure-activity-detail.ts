import { db } from '$lib/database';
import {
    fetchActivityDetail,
    type ActivityDetailPayload,
    type ActivitySample,
    type ActivitySplit,
    type FetchActivityDetailErrorCode,
} from './fetch-activity-detail';
import type { Prisma } from '@prisma/client';

/**
 * Minimal shape required from an `Activity` row (with `detail` included) to assemble its
 * `ActivityDetailPayload`, fetching the lazily-loaded splits + samples on first request.
 */
export interface ActivityWithDetail {
    id: string;
    garminActivityId: bigint;
    activityName: string | null;
    activityType: string;
    startTime: Date;
    durationSec: number | null;
    distanceM: number | null;
    detail: { splits: unknown; samples: unknown } | null;
}

export type EnsureActivityDetailResult =
    | { ok: true; detail: ActivityDetailPayload }
    | { ok: false; status: number; code: FetchActivityDetailErrorCode; message: string };

/**
 * Returns the activity's full detail payload, fetching its splits + downsampled samples from
 * the Garmin microservice and persisting them on first request. Idempotent: a cached
 * `ActivityDetail` short-circuits without any Garmin call. Shared by the activity-detail page
 * endpoint and the "Explain my run" endpoint so detail-fetching has a single source of truth.
 */
export async function ensureActivityDetail(
    userId: string,
    activity: ActivityWithDetail,
): Promise<EnsureActivityDetailResult> {
    if (activity.detail) {
        return {
            ok: true,
            detail: toPayload(activity, {
                splits: activity.detail.splits as unknown as ActivitySplit[],
                samples: activity.detail.samples as unknown as ActivitySample[],
            }),
        };
    }

    const fetched = await fetchActivityDetail({ userId, garminActivityId: activity.garminActivityId });
    if (!fetched.ok) {
        return { ok: false, status: fetched.status, code: fetched.code, message: fetched.message };
    }

    await db.activityDetail.upsert({
        where: { activityId: activity.id },
        create: {
            activityId: activity.id,
            splits: fetched.detail.splits as unknown as Prisma.InputJsonValue,
            samples: fetched.detail.samples as unknown as Prisma.InputJsonValue,
        },
        update: {
            splits: fetched.detail.splits as unknown as Prisma.InputJsonValue,
            samples: fetched.detail.samples as unknown as Prisma.InputJsonValue,
        },
    });

    return { ok: true, detail: toPayload(activity, fetched.detail) };
}

/** Projects the persisted activity metadata + splits/samples into the wire payload shape. */
function toPayload(
    activity: ActivityWithDetail,
    detail: { splits: ActivitySplit[]; samples: ActivitySample[] },
): ActivityDetailPayload {
    return {
        activityId: Number(activity.garminActivityId),
        activityName: activity.activityName,
        activityType: activity.activityType,
        startTimeGMT: activity.startTime.toISOString(),
        duration: activity.durationSec,
        distance: activity.distanceM,
        splits: detail.splits,
        samples: detail.samples,
    };
}
