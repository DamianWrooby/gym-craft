import { redirect } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/session-token';

/**
 * The AI proxy authenticates plan generation by matching the posted `session` against
 * `User.userAuthToken`, and the browser calls it directly (plan generation takes far longer than
 * a Netlify function may run), so the token has to reach the page.
 *
 * What travels is the *hashed* token — the value already stored in the DB column — never the raw
 * `session` cookie, which stays httpOnly. The hash cannot be replayed as a cookie (the app hashes
 * whatever the cookie holds before looking it up), so its blast radius is plan generation only,
 * not the account.
 */
export async function load({ locals, cookies }) {
    const user = locals?.user;

    if (!user.emailVerified) throw redirect(302, '/app');

    const session = cookies.get('session');

    return {
        proxySession: session ? hashSessionToken(session) : null,
    };
}
