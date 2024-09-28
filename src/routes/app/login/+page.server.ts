import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import { isProduction } from '$lib/utils/environment';
import type { Action, Actions } from '../$types';
import { isString } from '$lib/utils/form-validation';

import { db } from '$lib/database';

const login: Action = async ({ cookies, request }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');

    if (!isString(username) || !isString(password)) {
        return fail(400, { invalid: true });
    }

    const user = await db.user.findUnique({
        where: { username },
        select: {
            username: true,
            passwordHash: true,
        },
    });

    if (!user) {
        return fail(400, { credentials: true });
    }

    const userPassword = await bcrypt.compare(password, user.passwordHash);
    if (!userPassword) {
        return fail(400, { credentials: true });
    }

    const authenticatedUser = await db.user.update({
        where: { username: user.username },
        data: { userAuthToken: crypto.randomUUID() },
    });

    cookies.set('session', authenticatedUser.userAuthToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: isProduction(),
        maxAge: 60 * 60 * 24 * 30,
    });

    throw redirect(302, '/app');
};

export const actions: Actions = { login };
