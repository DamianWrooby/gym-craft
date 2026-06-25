import { getGarminSessionToken } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';
import { garminApiUrl, garminBearerKeyHeaders } from '$lib/server/garmin/config';

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
    const { workout } = body;

    if (!workout) return createResponse(400, { message: 'workout is required' });

    const [tokenError, sessionToken] = await to(getGarminSessionToken(userId));
    if (tokenError || !sessionToken) {
        return createResponse(401, { code: 'INVALID_TOKEN', message: 'No valid token found' });
    }

    const formData = new FormData();
    formData.append('file', new Blob([JSON.stringify(workout)], { type: 'application/json' }), 'workout.json');

    const url = `${garminApiUrl}/upload-workout`;
    const [fetchError, pyResponse] = await to(
        fetch(url, { method: 'POST', headers: garminBearerKeyHeaders(sessionToken), body: formData }),
    );

    if (fetchError || !pyResponse) {
        return createResponse(502, { message: fetchError?.message || 'Failed to reach Garmin service' });
    }

    const [parseError, data] = await to(pyResponse.json());
    if (parseError) return createResponse(502, { message: 'Invalid response from Garmin service' });

    if (!pyResponse.ok) {
        return createResponse(pyResponse.status, { message: data?.message || 'Garmin service error' });
    }

    return createResponse(200, { status: data?.status, message: data?.message });
}
