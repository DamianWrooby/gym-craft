import { to } from 'await-to-js';

export type AuthenticateGarminResult = { ok: true; sessionToken: string } | { ok: false; message: string };

/**
 * Exchanges the user's Garmin password for a session token via the SvelteKit endpoint, which
 * stores it server-side and returns it for the client-side proxy-sync path. Call this from a
 * Garmin login modal handler, then retry the action that failed with INVALID_TOKEN.
 */
export async function authenticateGarmin(userId: string, password: string): Promise<AuthenticateGarminResult> {
    const [fetchError, response] = await to(
        fetch(`/api/user/${userId}/garmin/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        }),
    );
    if (fetchError || !response) {
        return { ok: false, message: fetchError?.message ?? 'Request failed' };
    }

    const [parseError, data] = await to(response.json());
    if (parseError) {
        return { ok: false, message: 'Invalid response' };
    }
    if (!response.ok || !data?.sessionToken) {
        return { ok: false, message: data?.message ?? 'Authentication failed' };
    }
    return { ok: true, sessionToken: data.sessionToken };
}
