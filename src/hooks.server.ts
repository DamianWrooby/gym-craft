import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/database';

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

    const user = await db.user.findUnique({
        where: { userAuthToken: session },
        select: { id: true, username: true, role: true, generatedPlansNumber: true },
    });

    if (user) {
        event.locals.user = {
            id: user.id,
            name: user.username,
            role: user.role.name,
            generatedPlansNumber: user.generatedPlansNumber,
        };
    }

    return await resolve(event);
};
