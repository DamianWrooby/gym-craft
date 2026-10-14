import { createResponse } from '$lib/utils/response';
import { db } from '$lib/database';
import { isRunningTypeKey } from '$lib/utils/activity-type';
import { normalizeDetail } from '$lib/server/garmin/fetch-activity-detail';
import { storeActivityDetail } from '$lib/server/garmin/ensure-activity-detail';
import { scoreRunFromSamples } from '$lib/server/garmin/score-runs';

/** The Python service downsamples to ≤1000; anything far above that is not its payload. */
const MAX_SAMPLES = 5000;

/**
 * Store-and-score step of the proxy-driven detail fetch (ADR 0027). The browser fetched this
 * run's detail via the AI proxy after a sync and posts it here: database work only, no Garmin
 * call, so it stays well inside Netlify's function timeout.
 */
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

    const body = await request.json().catch(() => null);
    const garminActivityId = body?.garminActivityId;
    const raw = body?.detail;
    if (typeof garminActivityId !== 'string' || !/^\d{1,19}$/.test(garminActivityId)) {
        return createResponse(400, { code: 'INVALID_BODY', message: 'garminActivityId must be a numeric string' });
    }
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.samples) || raw.samples.length > MAX_SAMPLES) {
        return createResponse(400, { code: 'INVALID_BODY', message: 'detail must carry a samples list' });
    }

    const detail = normalizeDetail(raw);
    if (detail.activityId !== 0 && String(detail.activityId) !== garminActivityId) {
        return createResponse(400, { code: 'INVALID_BODY', message: 'detail belongs to another activity' });
    }

    const activity = await db.activity.findUnique({
        where: { userId_garminActivityId: { userId, garminActivityId: BigInt(garminActivityId) } },
        select: { id: true, activityType: true },
    });
    if (!activity) {
        return createResponse(404, { code: 'NOT_FOUND', message: 'Activity not found' });
    }

    await storeActivityDetail(activity.id, detail);
    const scored = isRunningTypeKey(activity.activityType)
        ? await scoreRunFromSamples(userId, activity.id, detail.samples)
        : false;

    return createResponse(200, { data: { scored } });
}
