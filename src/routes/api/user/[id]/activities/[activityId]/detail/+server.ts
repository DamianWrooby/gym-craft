import { createResponse } from '$lib/utils/response';
import { db } from '$lib/database';
import { ensureActivityDetail } from '$lib/server/garmin/ensure-activity-detail';

export async function POST({
    params,
    locals,
}: {
    params: { id: string; activityId: string };
    locals: App.Locals;
}): Promise<Response> {
    const userId = params.id;
    const activityId = params.activityId;

    if (userId !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }

    const activity = await db.activity.findFirst({
        where: { id: activityId, userId },
        select: {
            id: true,
            garminActivityId: true,
            activityName: true,
            activityType: true,
            startTime: true,
            durationSec: true,
            distanceM: true,
            detail: { select: { splits: true, samples: true, route: true, dynamics: true, schemaVersion: true } },
        },
    });

    if (!activity) {
        return createResponse(404, { code: 'ACTIVITY_NOT_FOUND', message: 'Activity not found' });
    }

    const result = await ensureActivityDetail(userId, activity);
    if (!result.ok) {
        return createResponse(result.status, { code: result.code, message: result.message });
    }

    // The page renders the time-series, running dynamics and route from this payload; activity
    // metadata (name, stats) is already on the page from the loader.
    return createResponse(200, {
        data: {
            detail: {
                splits: result.detail.splits,
                samples: result.detail.samples,
                route: result.detail.route,
                dynamics: result.detail.dynamics,
            },
        },
    });
}
