import { createResponse } from '$lib/utils/response';
import { db } from '$lib/database';
import { ensureActivityDetail } from '$lib/server/garmin/ensure-activity-detail';

export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string; activityId: string };
    locals: App.Locals;
}): Promise<Response> {
    const userId = params.id;
    const activityId = params.activityId;

    if (userId !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }

    const body = await request.json().catch(() => null);
    const password = typeof body?.password === 'string' ? body.password : undefined;

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
            detail: { select: { splits: true, samples: true } },
        },
    });

    if (!activity) {
        return createResponse(404, { code: 'ACTIVITY_NOT_FOUND', message: 'Activity not found' });
    }

    const result = await ensureActivityDetail(userId, activity, password);
    if (!result.ok) {
        return createResponse(result.status, { code: result.code, message: result.message });
    }

    // The client (chart + splits table) only needs the time-series; metadata is already on the page.
    return createResponse(200, { data: { detail: { splits: result.detail.splits, samples: result.detail.samples } } });
}
