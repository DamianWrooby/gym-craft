import { db } from '$lib/database';
import {
    fetchActivityDetail,
    type ActivityDetailPayload,
    type ActivityDynamics,
    type ActivitySample,
    type ActivitySplit,
    type FetchActivityDetailErrorCode,
    type RoutePoint,
} from './fetch-activity-detail';
import { Prisma } from '@prisma/client';

/** Bump when the detail wire shape changes so cached rows lazily re-fetch on next view. */
export const CURRENT_DETAIL_SCHEMA_VERSION = 2;

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
    detail: {
        splits: unknown;
        samples: unknown;
        route: unknown;
        dynamics: unknown;
        schemaVersion: number;
    } | null;
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
    if (activity.detail && activity.detail.schemaVersion >= CURRENT_DETAIL_SCHEMA_VERSION) {
        return {
            ok: true,
            detail: toPayload(activity, {
                splits: activity.detail.splits as unknown as ActivitySplit[],
                samples: activity.detail.samples as unknown as ActivitySample[],
                route: (activity.detail.route as unknown as RoutePoint[]) ?? [],
                dynamics: (activity.detail.dynamics as unknown as ActivityDynamics) ?? null,
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
            route: fetched.detail.route as unknown as Prisma.InputJsonValue,
            dynamics: (fetched.detail.dynamics ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
            schemaVersion: CURRENT_DETAIL_SCHEMA_VERSION,
        },
        update: {
            splits: fetched.detail.splits as unknown as Prisma.InputJsonValue,
            samples: fetched.detail.samples as unknown as Prisma.InputJsonValue,
            route: fetched.detail.route as unknown as Prisma.InputJsonValue,
            dynamics: (fetched.detail.dynamics ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
            schemaVersion: CURRENT_DETAIL_SCHEMA_VERSION,
        },
    });

    return { ok: true, detail: toPayload(activity, fetched.detail) };
}

/** Projects the persisted activity metadata + splits/samples/route/dynamics into the wire payload shape. */
function toPayload(
    activity: ActivityWithDetail,
    detail: {
        splits: ActivitySplit[];
        samples: ActivitySample[];
        route: RoutePoint[];
        dynamics: ActivityDynamics | null;
    },
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
        route: detail.route,
        dynamics: detail.dynamics,
    };
}
