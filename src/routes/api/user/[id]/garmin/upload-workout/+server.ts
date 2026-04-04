import { getGarminEmail } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';
import { appConfig } from '@/constants/app.constants';

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
    const { workout, password } = body;

    if (!workout) return createResponse(400, { message: 'workout is required' });

    const [emailError, email] = await to(getGarminEmail(userId));
    if (emailError || !email) return createResponse(400, { message: 'Garmin email not configured' });

    const formData = new FormData();
    formData.append('username', String(email));
    if (password) formData.append('password', password);
    formData.append('file', new Blob([JSON.stringify(workout)], { type: 'application/json' }), 'workout.json');

    const url = `${appConfig.internalGarminApiUrl}/upload-workout`;
    const [fetchError, pyResponse] = await to(fetch(url, { method: 'POST', body: formData }));

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
