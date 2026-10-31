import { m } from '$lib/paraglide/messages.js';
import { to } from 'await-to-js';
import { authenticateGarmin, submitGarminMfaCode, type AuthenticateGarminResult } from './authenticate';
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

/**
 * Asks the user for the code Garmin emailed (email MFA). `retry` is true after a wrong code.
 * Resolves null when the user cancels.
 */
export type AskGarminMfaCode = (retry: boolean) => Promise<string | null>;

/** Wrong codes the user may enter before the login gives up. */
const MAX_MFA_ATTEMPTS = 5;

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
 * When Garmin asks for an emailed MFA code, `askMfaCode` collects it between sign-in and retry.
 */
export async function withGarminLogin<R extends { ok: boolean; code?: string }>(
    userId: string,
    action: (login: GarminLogin | null) => Promise<R>,
    askCredentials: AskGarminCredentials,
    askMfaCode: AskGarminMfaCode,
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

    let auth = await authenticateGarmin(userId, credentials.password);
    if (!auth.ok && 'mfaTicket' in auth) {
        const mfa = await completeMfa(userId, auth.mfaTicket, askMfaCode);
        if (!mfa.ok) return mfa;
        auth = mfa;
    }
    if (!auth.ok)
        return {
            ok: false,
            code: 'LOGIN_FAILED',
            message: ('message' in auth && auth.message) || 'Garmin login failed',
        };

    return action({ sessionToken: auth.sessionToken, email: credentials.email });
}

async function completeMfa(
    userId: string,
    mfaTicket: string,
    askMfaCode: AskGarminMfaCode,
): Promise<{ ok: true; sessionToken: string } | GarminLoginFailure> {
    for (let attempt = 0; attempt < MAX_MFA_ATTEMPTS; attempt++) {
        const code = await askMfaCode(attempt > 0);
        if (!code) return { ok: false, code: 'LOGIN_CANCELLED', message: 'Garmin login cancelled' };

        const result: AuthenticateGarminResult = await submitGarminMfaCode(userId, mfaTicket, code);
        if (result.ok) return result;
        if (result.code === 'MFA_INVALID_CODE') continue;
        if (result.code === 'MFA_EXPIRED') return { ok: false, code: 'LOGIN_FAILED', message: m.garmin_mfa_expired() };
        return {
            ok: false,
            code: 'LOGIN_FAILED',
            message: 'message' in result ? result.message : 'Garmin login failed',
        };
    }
    return { ok: false, code: 'LOGIN_FAILED', message: 'Garmin login failed' };
}

async function saveGarminEmail(userId: string, email: string): Promise<boolean> {
    const [error, response] = await to(
        fetch(`/api/user/${userId}/garmin/save-email`, { method: 'POST', body: JSON.stringify({ email }) }),
    );
    return !error && !!response?.ok;
}
