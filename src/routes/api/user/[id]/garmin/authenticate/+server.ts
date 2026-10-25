import { m } from '$lib/paraglide/messages.js';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';
import { getGarminEmail, saveGarminSessionToken } from '$lib/prisma/prisma';
import { garminApiUrl, garminApiHeaders } from '$lib/server/garmin/config';

/**
 * Exchanges the user's Garmin password for an opaque session token from the curl_cffi
 * microservice, and persists it. The token (not the password) becomes the identity for all
 * subsequent Garmin calls. Returns the token to the browser so the client-side proxy-sync path
 * can send it as a Bearer header.
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
        return createResponse(403, { message: m.api_unauthorized() });
    }

    const body = await request.json().catch(() => null);
    const password = typeof body?.password === 'string' ? body.password : undefined;
    if (!password) {
        return createResponse(400, { message: m.api_password_required() });
    }

    const [emailError, email] = await to(getGarminEmail(userId));
    if (emailError || !email) {
        return createResponse(400, { code: 'GARMIN_EMAIL_NOT_CONFIGURED', message: m.api_garmin_email_missing() });
    }

    const url = `${garminApiUrl}/authenticate`;
    const [fetchError, pyResponse] = await to(
        fetch(url, {
            method: 'POST',
            headers: garminApiHeaders(),
            body: JSON.stringify({ username: String(email), password }),
        }),
    );

    if (fetchError || !pyResponse) {
        return createResponse(502, { message: fetchError?.message || 'Failed to reach Garmin service' });
    }

    const [parseError, data] = await to(pyResponse.json());
    if (parseError) {
        return createResponse(502, { message: m.api_garmin_invalid_response() });
    }

    if (!pyResponse.ok || !data?.session_token) {
        return createResponse(pyResponse.status === 200 ? 502 : pyResponse.status, {
            message: data?.message || 'Garmin authentication failed',
        });
    }

    const sessionToken: string = data.session_token;
    const [saveError] = await to(saveGarminSessionToken(userId, sessionToken));
    if (saveError) {
        return createResponse(500, { message: m.api_garmin_session_failed() });
    }

    return createResponse(200, { status: 'success', sessionToken });
}
