import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { updateUser } from '$lib/utils/user';

const publicPaths = new Set([
    '/',
    '/app',
    '/app/register',
    '/app/login',
    '/verification-mail-sent',
    '/privacy-policy',
    '/terms-of-use',
]);

const publicPathPrefixes = ['/app/verify/'];

function isPathAllowed(path: string) {
    if (publicPaths.has(path)) return true;
    return publicPathPrefixes.some((prefix) => path.startsWith(prefix));
}

export const handle: Handle = async ({ event, resolve }) => {
    const session = event.cookies.get('session');
    const url = new URL(event.request.url);

    if (!session) {
        if (isPathAllowed(url.pathname)) {
            return addSecurityHeaders(await resolve(event));
        } else {
            throw redirect(302, '/app/login');
        }
    }

    await updateUser(event);

    return addSecurityHeaders(await resolve(event));
};

function addSecurityHeaders(response: Response): Response {
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return response;
}
