/**
 * The one place that decides what a failed Garmin call means. Server routes, the proxy sync and
 * the browser upload all read Garmin failures through this, so a new tag (MFA, say) is added once.
 *
 * Order matters: a 429 must win over everything. Reading a throttle as an expired session sends
 * the athlete to a password prompt whose cold login is the most throttled path there is.
 */
export type GarminFailureKind = 'RATE_LIMITED' | 'INVALID_TOKEN' | 'TIMEOUT' | 'OTHER';

/** The substring older Garmin service builds emit when the stored token has expired. */
const LEGACY_INVALID_TOKEN_MESSAGE = 'No valid token found';

export function classifyGarminFailure(
    status: number | undefined,
    payload: { code?: unknown; message?: unknown } | null | undefined,
): GarminFailureKind {
    const message = typeof payload?.message === 'string' ? payload.message : '';
    if (status === 429 || payload?.code === 'RATE_LIMITED') return 'RATE_LIMITED';
    if (status === 401 || payload?.code === 'INVALID_TOKEN' || message.includes(LEGACY_INVALID_TOKEN_MESSAGE)) {
        return 'INVALID_TOKEN';
    }
    // 504 is the proxy giving up on Garmin after 120s — transient, and worth retrying.
    if (status === 504) return 'TIMEOUT';
    return 'OTHER';
}
