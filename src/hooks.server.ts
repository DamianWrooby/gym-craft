import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/database';

export const handle: Handle = async ({ event, resolve }) => {
    const session = event.cookies.get('session');

    if (!session) {
        return await resolve(event);
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
