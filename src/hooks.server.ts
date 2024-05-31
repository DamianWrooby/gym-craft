import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { updateUser } from '$lib/utils/user';

const public_paths = ['/', '/register', '/login'];

function isPathAllowed(path: string) {
    return public_paths.some((allowedPath) => path === allowedPath || path.startsWith(allowedPath + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
    const session = event.cookies.get('session');
    const url = new URL(event.request.url);

    if (!session) {
        if (isPathAllowed(url.pathname)) {
            return await resolve(event);
        } else {
            throw redirect(302, '/login');
        }
    }

    await updateUser(event);

    return await resolve(event);
};
