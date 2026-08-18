import { createResponse } from '$lib/utils/response';
import { refreshGarminSession } from '$lib/server/garmin/refresh-session';

/**
 * Renews the athlete's Garmin session without their password, for the browser-driven sync path.
 *
 * The server call sites get renewal from `withGarminSession`, but the proxy-sync path runs in the
 * browser and has no database access, so it comes here instead. Both funnel into the same
 * `refreshGarminSession`, so there is one renewal implementation rather than two that drift.
 *
 * The Garmin email is never read from this request. `refreshGarminSession` looks it up from the
 * authenticated user's own record, which is what keeps the microservice's email-keyed refresh route
 * from being an impersonation bypass.
 *
 * `staleToken` is only a hint for the compare-and-swap: the caller says which token failed, so a
 * refresh that another request already completed is returned rather than minted again.
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
    const staleToken = typeof body?.staleToken === 'string' ? body.staleToken : null;

    const refreshed = await refreshGarminSession(userId, staleToken);
    if (!refreshed.ok) {
        return createResponse(refreshed.status, { code: refreshed.code, message: refreshed.message });
    }

    return createResponse(200, { status: 'success', sessionToken: refreshed.sessionToken });
}
