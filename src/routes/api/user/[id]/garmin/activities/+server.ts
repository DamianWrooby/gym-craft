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
    const { startDate, endDate, activityType, password } = body;

    if (!startDate) return createResponse(400, { message: 'startDate is required' });

    const [emailError, email] = await to(getGarminEmail(userId));
    if (emailError || !email) {
        return createResponse(400, { code: 'GARMIN_EMAIL_NOT_CONFIGURED', message: 'Garmin email not configured' });
    }

    const requestBody: Record<string, string> = { username: String(email), startDate };
    if (password) requestBody.password = password;
    if (endDate) requestBody.endDate = endDate;
    if (activityType) requestBody.activityType = activityType;

    const url = `${appConfig.internalGarminApiUrl}/activities`;
    const [fetchError, pyResponse] = await to(
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        }),
    );

    if (fetchError || !pyResponse) {
        return createResponse(502, { message: fetchError?.message || 'Failed to reach Garmin service' });
    }

    const [parseError, data] = await to(pyResponse.json());
    if (parseError) return createResponse(502, { message: 'Invalid response from Garmin service' });

    if (!pyResponse.ok) {
        const message = data?.message || 'Garmin service error';
        let code = 'GARMIN_SERVICE_ERROR';
        if (message.includes('No valid token found')) code = 'INVALID_TOKEN';
        return createResponse(pyResponse.status, { code, message });
    }

    return createResponse(200, { data: data?.data });
}
