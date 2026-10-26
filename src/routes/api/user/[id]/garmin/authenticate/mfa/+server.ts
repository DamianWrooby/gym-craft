import { m } from '$lib/paraglide/messages.js';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';
import { saveGarminSessionToken } from '$lib/prisma/prisma';
import { garminApiUrl, garminApiHeaders } from '$lib/server/garmin/config';

/**
 * Second step of a Garmin login that hit email MFA: sends the ticket from `../authenticate` and
 * the emailed code to the microservice, then persists the session token like the first step.
 * Passes `MFA_INVALID_CODE` (ticket still usable) and `MFA_EXPIRED` (start again) through.
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
    const mfaTicket = typeof body?.mfaTicket === 'string' ? body.mfaTicket : undefined;
    const code = typeof body?.code === 'string' ? body.code.trim() : undefined;
    if (!mfaTicket || !code) {
        return createResponse(400, { message: m.api_garmin_mfa_code_required() });
    }

    const [fetchError, pyResponse] = await to(
        fetch(`${garminApiUrl}/authenticate/mfa`, {
            method: 'POST',
            headers: garminApiHeaders(),
            body: JSON.stringify({ mfa_ticket: mfaTicket, code }),
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
            code: data?.code,
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
