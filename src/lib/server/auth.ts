import { error, type RequestEvent } from '@sveltejs/kit';

interface AuthenticatedUser {
    id: string;
    name: string;
    role: string;
}

export function getAuthenticatedUser(event: RequestEvent): AuthenticatedUser {
    const user = event.locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }
    return user;
}

export function assertOwnership(event: RequestEvent, resourceUserId: string): AuthenticatedUser {
    const user = getAuthenticatedUser(event);
    if (user.id !== resourceUserId) {
        throw error(403, 'Forbidden');
    }
    return user;
}
