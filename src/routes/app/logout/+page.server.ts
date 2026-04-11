import { redirect } from '@sveltejs/kit';
import crypto from 'crypto';
import { db } from '$lib/database';
import { isProduction } from '$lib/utils/environment';
import type { Actions, PageServerLoad } from '../$types';

function hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export const load: PageServerLoad = async () => {
    throw redirect(302, '/app');
};

export const actions: Actions = {
    async default({ cookies }) {
        const session = cookies.get('session');

        if (session) {
            const hashedSession = hashSessionToken(session);
            await db.user.updateMany({
                where: { userAuthToken: hashedSession },
                data: { userAuthToken: crypto.randomUUID() },
            });
        }

        cookies.set('session', '', {
            path: '/',
            expires: new Date(0),
            httpOnly: true,
            sameSite: 'strict',
            secure: isProduction(),
        });

        throw redirect(302, '/app/login');
    },
};
