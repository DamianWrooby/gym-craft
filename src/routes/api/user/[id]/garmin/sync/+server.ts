import { createResponse } from '$lib/utils/response';
import { db } from '$lib/database';
import { syncUserActivities, persistActivities } from '$lib/server/garmin/sync-activities';
import { mapGarminActivities } from '$lib/server/garmin/activity-mapper';
import type { SyncMode } from '$lib/garmin/sync-window';
import type { GarminActivityRaw } from '@/models/garmin/activity.model';

/** Upper bound on a single persist request (well above 90 days for any realistic athlete). */
const MAX_SYNC_ACTIVITIES = 1500;

export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string };
    locals: App.Locals;
}): Promise<Response> {
    const userId = params.id;

    if (userId !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }

    const body = await request.json().catch(() => ({}));

    // Proxy-driven path: the browser already fetched activities via the AI proxy and posts
    // them here for a fast map + upsert (bypasses Netlify's 30s timeout on the slow fetch).
    if (body && Array.isArray(body.activities)) {
        return persistFromClient(userId, body);
    }

    // Backward-compatible fallback: perform the slow server-side fetch + persist. Kept so any
    // caller that still posts only `{ password }` (or nothing) keeps working.
    const password = typeof body?.password === 'string' ? body.password : undefined;
    const result = await syncUserActivities(userId, password);

    if (!result.ok) {
        return createResponse(result.status, { code: result.code, message: result.message });
    }

    return createResponse(200, {
        data: {
            mode: result.mode,
            activitiesUpserted: result.activitiesUpserted,
            lastSyncedAt: result.lastSyncedAt.toISOString(),
        },
    });
}

async function persistFromClient(userId: string, body: { activities: unknown; mode?: unknown }): Promise<Response> {
    const activities = body.activities as unknown[];

    if (activities.length > MAX_SYNC_ACTIVITIES) {
        return createResponse(400, { code: 'INVALID_PAYLOAD', message: 'Too many activities in a single sync' });
    }
    if (!activities.every(isWellFormedRawActivity)) {
        return createResponse(400, { code: 'INVALID_PAYLOAD', message: 'Malformed activity payload' });
    }

    // The server's own sync state is authoritative for whether this is a backfill or an
    // incremental sync — never trust the client to flip `backfillComplete`.
    const state = await db.garminSyncState.findUnique({ where: { userId } });
    const serverMode: SyncMode = state?.backfillComplete ? 'incremental' : 'backfill';

    const clientMode = body.mode;
    if ((clientMode === 'backfill' || clientMode === 'incremental') && clientMode !== serverMode) {
        return createResponse(409, { code: 'STALE_STATE', message: 'Sync state changed, please retry' });
    }

    try {
        const mapped = mapGarminActivities(activities as GarminActivityRaw[]);
        const result = await persistActivities(userId, mapped, serverMode);

        if (!result.ok) {
            return createResponse(result.status, { code: result.code, message: result.message });
        }

        return createResponse(200, {
            data: {
                mode: result.mode,
                activitiesUpserted: result.activitiesUpserted,
                lastSyncedAt: result.lastSyncedAt.toISOString(),
            },
        });
    } catch (err) {
        return createResponse(500, {
            code: 'PERSIST_FAILED',
            message: err instanceof Error ? err.message : 'Failed to persist activities',
        });
    }
}

function isWellFormedRawActivity(value: unknown): value is GarminActivityRaw {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    if (typeof obj.activityId !== 'number') return false;
    const type = obj.activityType as { typeKey?: unknown } | undefined;
    return !!type && typeof type === 'object' && typeof type.typeKey === 'string';
}
