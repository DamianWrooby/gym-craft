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

const LOGIN_PAGE_PATH = '/app/login';
const DATA_SUFFIX = '/__data.json';

const publicPathPrefixes = ['/app/verify/'];

function isPathAllowed(path: string) {
    if (publicPaths.has(path)) return true;
    return publicPathPrefixes.some((prefix) => path.startsWith(prefix));
}

function routePath(rawPath: string) {
    if (!rawPath.endsWith(DATA_SUFFIX)) return rawPath;
    const stripped = rawPath.slice(0, -DATA_SUFFIX.length);
    return stripped === '' ? '/' : stripped;
}

export const handle: Handle = async ({ event, resolve }) => {
    const session = event.cookies.get('session');
    const pathname = routePath(new URL(event.request.url).pathname);

    if (pathname === LOGIN_PAGE_PATH) {
        if (session) await updateUser(event);
        return addSecurityHeaders(await resolve(event));
    }

    if (!session) {
        if (isPathAllowed(pathname)) {
            return addSecurityHeaders(await resolve(event));
        }
        throw redirect(302, LOGIN_PAGE_PATH);
    }

    await updateUser(event);

    if (!event.locals.user) {
        event.cookies.delete('session', { path: '/' });
        if (isPathAllowed(pathname)) {
            return addSecurityHeaders(await resolve(event));
        }
        throw redirect(302, LOGIN_PAGE_PATH);
    }

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
