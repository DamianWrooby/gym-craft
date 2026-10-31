import { to } from 'await-to-js';

export type RefreshSessionResult =
    | { ok: true; sessionToken: string }
    | { ok: false; code: 'INVALID_TOKEN' | 'RATE_LIMITED' | 'PROXY_ERROR'; message: string };

/**
 * Asks the server to renew the Garmin session without the athlete's password.
 *
 * `staleToken` is the token that was just rejected. The server compares it against the stored one
 * and hands back a session another request already minted rather than minting a second — which is
 * what stops a page-load burst from issuing several sessions at once.
 *
 * `INVALID_TOKEN` back from here is the only answer that justifies the Garmin login modal: it means
 * the stored authorization is dead, not merely expired. `RATE_LIMITED` must never open the modal.
 */
export async function refreshGarminSession(userId: string, staleToken: string | null): Promise<RefreshSessionResult> {
    const [fetchError, response] = await to(
        fetch(`/api/user/${userId}/garmin/session/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staleToken }),
        }),
    );
    if (fetchError || !response) {
        return { ok: false, code: 'PROXY_ERROR', message: fetchError?.message ?? 'Request failed' };
    }

    const [parseError, data] = await to(response.json());
    if (parseError) {
        return { ok: false, code: 'PROXY_ERROR', message: 'Invalid response' };
    }

    if (response.ok && data?.sessionToken) {
        return { ok: true, sessionToken: data.sessionToken };
    }

    const message = typeof data?.message === 'string' ? data.message : 'Could not renew the Garmin session';
    if (response.status === 429 || data?.code === 'RATE_LIMITED') {
        return { ok: false, code: 'RATE_LIMITED', message };
    }
    if (response.status === 401 || data?.code === 'INVALID_TOKEN') {
        return { ok: false, code: 'INVALID_TOKEN', message };
    }
    return { ok: false, code: 'PROXY_ERROR', message };
}
