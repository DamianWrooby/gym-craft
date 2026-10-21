import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';
import { garminApiUrl, garminBearerKeyHeaders } from '$lib/server/garmin/config';
import { classifyGarminStatus } from '$lib/server/garmin/fetch-activities';
import { getUploadableSession } from '$lib/server/planner/sessions';
import { toGarminWorkout } from '$lib/server/garmin/workout-adapter';
import { withGarminSession, type GarminAttemptResult } from '$lib/server/garmin/with-garmin-session';

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

    // The browser names a planned session and nothing else; the server builds the workout (spec #409).
    const body = await request.json().catch(() => null);
    const keys = body && typeof body === 'object' ? Object.keys(body) : [];
    if (keys.length !== 1 || typeof body.plannedSessionId !== 'string') {
        return createResponse(400, { code: 'INVALID_BODY', message: 'Send only plannedSessionId' });
    }

    const session = await getUploadableSession(userId, body.plannedSessionId);
    if (!session) return createResponse(404, { code: 'NOT_FOUND', message: 'Session not found' });
    const adapted = toGarminWorkout(session);
    if (!adapted.ok) return createResponse(422, { code: adapted.code, message: adapted.message });
    const workout = adapted.workout;

    // Renewal lives in the seam, so an expired session costs the athlete nothing: the upload is
    // retried once against a fresh session rather than failing back to a Garmin login prompt.
    const result = await withGarminSession(userId, (sessionToken) => uploadWorkout(sessionToken, workout));
    if (!result.ok) {
        return createResponse(result.status, { code: result.code, message: result.message });
    }

    return createResponse(200, { status: result.value.status, message: result.value.message });
}

async function uploadWorkout(
    sessionToken: string,
    workout: unknown,
): Promise<GarminAttemptResult<{ status?: string; message?: string }>> {
    const formData = new FormData();
    formData.append('file', new Blob([JSON.stringify(workout)], { type: 'application/json' }), 'workout.json');

    const [fetchError, pyResponse] = await to(
        fetch(`${garminApiUrl}/upload-workout`, {
            method: 'POST',
            headers: garminBearerKeyHeaders(sessionToken),
            body: formData,
        }),
    );

    if (fetchError || !pyResponse) {
        return {
            ok: false,
            status: 502,
            code: 'GARMIN_SERVICE_UNREACHABLE',
            message: fetchError?.message || 'Failed to reach Garmin service',
        };
    }

    const [parseError, data] = await to(pyResponse.json());
    if (parseError) {
        return {
            ok: false,
            status: 502,
            code: 'GARMIN_SERVICE_PARSE_ERROR',
            message: 'Invalid response from Garmin service',
        };
    }

    if (!pyResponse.ok) {
        const message: string = data?.message || 'Garmin service error';
        return {
            ok: false,
            status: pyResponse.status,
            code: classifyGarminStatus(pyResponse.status, data, message),
            message,
        };
    }

    return { ok: true, value: { status: data?.status, message: data?.message } };
}
