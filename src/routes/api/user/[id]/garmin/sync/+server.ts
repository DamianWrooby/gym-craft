import { createResponse } from '$lib/utils/response';
import { syncUserActivities } from '$lib/server/garmin/sync-activities';

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
