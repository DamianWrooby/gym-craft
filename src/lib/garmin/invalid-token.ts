/** The exact substring the Python Garmin service emits when the stored token has expired. */
export const INVALID_TOKEN_MESSAGE = 'No valid token found';

/** True when an upstream Garmin error message indicates the token expired and a password is needed. */
export function isInvalidTokenMessage(message: string | undefined | null): boolean {
    return !!message && message.includes(INVALID_TOKEN_MESSAGE);
}

/**
 * True when a failed Garmin call means the stored token is unusable and the user must log in.
 * Checks the status and the `code` tag first; the message substring is the legacy fallback.
 */
export function isInvalidTokenResponse(
    status: number | undefined,
    payload: { code?: unknown; message?: unknown } | null | undefined,
): boolean {
    if (status === 401 || payload?.code === 'INVALID_TOKEN') return true;
    return typeof payload?.message === 'string' && isInvalidTokenMessage(payload.message);
}
