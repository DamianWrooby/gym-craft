import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { updateUser } from '$lib/utils/user';

const publicPaths = [
    '/',
    '/app',
    '/app/register',
    '/app/login',
    '/app/verify',
    '/verification-mail-sent',
    '/privacy-policy',
    '/terms-of-use',
];

function isPathAllowed(path: string) {
    return publicPaths.some((allowedPath) => path === allowedPath || path.startsWith(allowedPath + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
    const session = event.cookies.get('session');
    const url = new URL(event.request.url);

    if (!session) {
        if (isPathAllowed(url.pathname)) {
            return await resolve(event);
        } else {
            throw redirect(302, '/app/login');
        }
    }

    await updateUser(event);

    return await resolve(event);
};
