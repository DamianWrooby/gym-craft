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

    const configuration = await db.configuration.findFirst({
        where: { name: 'generalPlanLimit' },
        select: { value: true },
    });

    const plansLeft = configuration && user ? +configuration.value - user.generatedPlansNumber : 0;

    if (user) {
        const { id, username, role, generatedPlansNumber } = user;
        event.locals.user = { id, name: username, role: role.name, generatedPlansNumber, plansLeft, session };
    }

    return await resolve(event);
};
