import { to } from 'await-to-js';
import { getGarminSessionToken } from '$lib/prisma/prisma';
import { refreshGarminSession } from './refresh-session';

export type GarminAttemptErrorCode =
    | 'GARMIN_EMAIL_NOT_CONFIGURED'
    | 'GARMIN_SERVICE_UNREACHABLE'
    | 'GARMIN_SERVICE_PARSE_ERROR'
    | 'INVALID_TOKEN'
    | 'RATE_LIMITED'
    | 'GARMIN_SERVICE_ERROR';

export type GarminAttemptResult<T> =
    { ok: true; value: T } | { ok: false; status: number; code: GarminAttemptErrorCode; message: string };

/**
 * Runs a Garmin call with a usable session, renewing one silently when the call is refused.
 *
 * Renewal belongs here rather than in each caller: three server call sites would otherwise repeat
 * the same fetch-token / retry / classify dance, and the day one of them forgot, an athlete would
 * see a password prompt for a session the server could have replaced by itself.
 *
 * Two rules hold the design together:
 *
 * 1. Retry exactly once. A second `INVALID_TOKEN` against a session minted moments ago means the
 *    stored Garmin authorization is genuinely dead, which is the one case worth troubling the
 *    athlete about. Looping would only turn that into a slower way to reach the same prompt.
 * 2. `RATE_LIMITED` returns immediately and is never retried. A throttle is not a credential
 *    failure. Retrying it — or worse, prompting for a password, whose cold login is the most
 *    rate-limited path there is — is what turned a Garmin throttle into a login loop before.
 */
export async function withGarminSession<T>(
    userId: string,
    attempt: (sessionToken: string) => Promise<GarminAttemptResult<T>>,
): Promise<GarminAttemptResult<T>> {
    const [tokenError, storedToken] = await to(getGarminSessionToken(userId));
    const sessionToken = tokenError ? null : storedToken;

    // No session at all is still renewable: the stored authorization outlives the session, so an
    // athlete who has signed in before does not have to do it again just because the token is gone.
    if (!sessionToken) {
        return renewThenAttempt(userId, null, attempt);
    }

    const first = await attempt(sessionToken);
    if (first.ok || first.code !== 'INVALID_TOKEN') {
        return first;
    }

    return renewThenAttempt(userId, sessionToken, attempt);
}

async function renewThenAttempt<T>(
    userId: string,
    staleToken: string | null,
    attempt: (sessionToken: string) => Promise<GarminAttemptResult<T>>,
): Promise<GarminAttemptResult<T>> {
    const refreshed = await refreshGarminSession(userId, staleToken);
    if (!refreshed.ok) {
        return { ok: false, status: refreshed.status, code: refreshed.code, message: refreshed.message };
    }
    return attempt(refreshed.sessionToken);
}
