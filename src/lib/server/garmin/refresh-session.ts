import { to } from 'await-to-js';
import { getGarminEmail, getGarminSessionToken, saveGarminSessionToken } from '$lib/prisma/prisma';
import { garminApiUrl, garminApiHeaders } from './config';

export type RefreshGarminSessionErrorCode =
    | 'GARMIN_EMAIL_NOT_CONFIGURED'
    | 'INVALID_TOKEN'
    | 'RATE_LIMITED'
    | 'GARMIN_SERVICE_UNREACHABLE'
    | 'GARMIN_SERVICE_ERROR';

export type RefreshGarminSessionResult =
    | { ok: true; sessionToken: string; minted: boolean }
    | { ok: false; status: number; code: RefreshGarminSessionErrorCode; message: string };

/**
 * Mints a fresh Garmin session from the athlete's stored Garmin authorization, without their
 * password. The microservice keeps that authorization in `garmin.garmin_tokens`; it outlives any
 * single session, so an expired session is a renewable condition rather than a reason to ask the
 * athlete for anything.
 *
 * The email is read here, server-side, from the authenticated user's own `GarminData` row. It is
 * never accepted from a caller. That is the whole security argument for the microservice's
 * `/session/refresh` route: identity is the email again, which would be the old impersonation
 * bypass if a browser could choose it.
 *
 * `staleToken` is the token the caller just had rejected. When the stored token no longer matches
 * it, another request already refreshed, so this returns that token instead of minting a second
 * one — the compare-and-swap that keeps a page-load burst from issuing four sessions.
 *
 * `INVALID_TOKEN` here means the authorization itself is dead (password changed, MFA, revoked) and
 * only the athlete can fix it. `RATE_LIMITED` means the authorization is fine and Garmin is busy —
 * the caller must back off, never prompt.
 */
export async function refreshGarminSession(
    userId: string,
    staleToken: string | null,
): Promise<RefreshGarminSessionResult> {
    const [storedError, storedToken] = await to(getGarminSessionToken(userId));
    if (!storedError && storedToken && storedToken !== staleToken) {
        return { ok: true, sessionToken: storedToken, minted: false };
    }

    const [emailError, email] = await to(getGarminEmail(userId));
    if (emailError || !email) {
        return {
            ok: false,
            status: 400,
            code: 'GARMIN_EMAIL_NOT_CONFIGURED',
            message: 'Garmin email not configured',
        };
    }

    const [fetchError, pyResponse] = await to(
        fetch(`${garminApiUrl}/session/refresh`, {
            method: 'POST',
            headers: garminApiHeaders(),
            body: JSON.stringify({ username: String(email) }),
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
            code: 'GARMIN_SERVICE_ERROR',
            message: 'Invalid response from Garmin service',
        };
    }

    if (!pyResponse.ok || !data?.session_token) {
        return { ok: false, status: pyResponse.status, ...classifyRefreshFailure(pyResponse.status, data) };
    }

    const sessionToken: string = data.session_token;
    const [saveError] = await to(saveGarminSessionToken(userId, sessionToken));
    if (saveError) {
        return { ok: false, status: 500, code: 'GARMIN_SERVICE_ERROR', message: 'Failed to persist Garmin session' };
    }

    return { ok: true, sessionToken, minted: true };
}

/**
 * Maps the microservice's refusal onto a caller-facing code. `REAUTH_REQUIRED` becomes
 * `INVALID_TOKEN` because that is the code every existing caller already treats as "show the Garmin
 * login" — the meaning is identical and renaming it would touch every call site for nothing.
 */
function classifyRefreshFailure(
    status: number,
    payload: { code?: string; message?: string } | null,
): { code: RefreshGarminSessionErrorCode; message: string } {
    const message = payload?.message ?? 'Garmin session refresh failed';
    if (status === 429 || payload?.code === 'RATE_LIMITED') {
        return { code: 'RATE_LIMITED', message };
    }
    if (status === 401 || payload?.code === 'REAUTH_REQUIRED') {
        return { code: 'INVALID_TOKEN', message };
    }
    return { code: 'GARMIN_SERVICE_ERROR', message };
}
