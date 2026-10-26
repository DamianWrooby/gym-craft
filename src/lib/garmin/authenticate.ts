import { to } from 'await-to-js';

export type AuthenticateGarminResult =
    | { ok: true; sessionToken: string }
    | { ok: false; code: 'MFA_REQUIRED'; mfaTicket: string }
    | { ok: false; code?: string; message: string };

/**
 * Exchanges the user's Garmin password for a session token via the SvelteKit endpoint, which
 * stores it server-side and returns it for the client-side proxy-sync path. Call this from a
 * Garmin login modal handler, then retry the action that failed with INVALID_TOKEN.
 *
 * When Garmin emails the user an MFA code, resolves `MFA_REQUIRED` with a ticket; finish the
 * login with `submitGarminMfaCode`.
 */
export async function authenticateGarmin(userId: string, password: string): Promise<AuthenticateGarminResult> {
    return postForSession(`/api/user/${userId}/garmin/authenticate`, { password });
}

/**
 * Second login step after `MFA_REQUIRED`. Fails with `MFA_INVALID_CODE` (the ticket still works,
 * ask again) or `MFA_EXPIRED` (start again with the password).
 */
export async function submitGarminMfaCode(
    userId: string,
    mfaTicket: string,
    code: string,
): Promise<AuthenticateGarminResult> {
    return postForSession(`/api/user/${userId}/garmin/authenticate/mfa`, { mfaTicket, code });
}

async function postForSession(url: string, body: Record<string, string>): Promise<AuthenticateGarminResult> {
    const [fetchError, response] = await to(
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
    );
    if (fetchError || !response) {
        return { ok: false, message: fetchError?.message ?? 'Request failed' };
    }

    const [parseError, data] = await to(response.json());
    if (parseError) {
        return { ok: false, message: 'Invalid response' };
    }
    if (response.ok && data?.code === 'MFA_REQUIRED' && data?.mfaTicket) {
        return { ok: false, code: 'MFA_REQUIRED', mfaTicket: data.mfaTicket };
    }
    if (!response.ok || !data?.sessionToken) {
        return { ok: false, code: data?.code, message: data?.message ?? 'Authentication failed' };
    }
    return { ok: true, sessionToken: data.sessionToken };
}
