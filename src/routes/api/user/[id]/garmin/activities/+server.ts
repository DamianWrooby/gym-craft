import { createResponse } from '$lib/utils/response';
import { fetchGarminActivities } from '$lib/server/garmin/fetch-activities';

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

    const body = await request.json();
    const { startDate, endDate, activityType, password } = body;

    if (!startDate) return createResponse(400, { message: 'startDate is required' });

    const result = await fetchGarminActivities({ userId, startDate, endDate, activityType, password });

    if (!result.ok) {
        return createResponse(result.status, { code: result.code, message: result.message });
    }

    return createResponse(200, { data: result.activities });
}
