import { to } from 'await-to-js';
import { authenticateGarmin } from './authenticate';
import { validateGarminLoginFormData } from '$lib/utils/form-validation';

/*
 * Garmin re-login, in one place (design review of #385/#395).
 *
 * Every browser-side Garmin action (plan upload, running sync, analytics sync) needs the same
 * recovery when the server says the stored authorization is dead: ask for credentials, store the
 * email, exchange the password for a session, retry the action once. Callers pass the action and
 * a way to ask for credentials; they never sequence those steps themselves.
 */

export type GarminCredentials = { email: string; password: string };

/** What the retry gets after a successful sign-in. */
export type GarminLogin = { sessionToken: string; email: string };

/** Asks the user for Garmin credentials. Resolves null when the user cancels. */
export type AskGarminCredentials = () => Promise<GarminCredentials | null>;

export type GarminLoginFailure = {
    ok: false;
    code: 'LOGIN_CANCELLED' | 'LOGIN_FAILED';
    message: string;
};

/** Failure codes that mean "the user must sign in to Garmin" rather than "try again". */
const NEEDS_LOGIN = new Set(['INVALID_TOKEN', 'GARMIN_EMAIL_NOT_CONFIGURED']);

/**
 * Runs `action`. When it fails because Garmin needs a login, asks for credentials once, signs in,
 * and runs `action` again with the new session token. Never loops: a second failure is returned.
 *
 * `action` receives `null` on the first attempt and the new login (session token + email) on the retry.
 */
export async function withGarminLogin<R extends { ok: boolean; code?: string }>(
    userId: string,
    action: (login: GarminLogin | null) => Promise<R>,
    askCredentials: AskGarminCredentials,
): Promise<R | GarminLoginFailure> {
    const first = await action(null);
    if (first.ok || !first.code || !NEEDS_LOGIN.has(first.code)) return first;

    const credentials = await askCredentials();
    if (!credentials) return { ok: false, code: 'LOGIN_CANCELLED', message: 'Garmin login cancelled' };
    if (validateGarminLoginFormData(credentials)) {
        return { ok: false, code: 'LOGIN_FAILED', message: 'Form validation error' };
    }

    // Store the email first: the password exchange signs in with the stored email.
    if (!(await saveGarminEmail(userId, credentials.email))) {
        return { ok: false, code: 'LOGIN_FAILED', message: 'Cannot save your Garmin email' };
    }

    const auth = await authenticateGarmin(userId, credentials.password);
    if (!auth.ok) return { ok: false, code: 'LOGIN_FAILED', message: auth.message || 'Garmin login failed' };

    return action({ sessionToken: auth.sessionToken, email: credentials.email });
}

async function saveGarminEmail(userId: string, email: string): Promise<boolean> {
    const [error, response] = await to(
        fetch(`/api/user/${userId}/garmin/save-email`, { method: 'POST', body: JSON.stringify({ email }) }),
    );
    return !error && !!response?.ok;
}
