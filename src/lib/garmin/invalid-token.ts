/** The exact substring the Python Garmin service emits when the stored token has expired. */
export const INVALID_TOKEN_MESSAGE = 'No valid token found';

/** True when an upstream Garmin error message indicates the token expired and a password is needed. */
export function isInvalidTokenMessage(message: string | undefined | null): boolean {
    return !!message && message.includes(INVALID_TOKEN_MESSAGE);
}
