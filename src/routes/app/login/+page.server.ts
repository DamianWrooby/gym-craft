import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { isProduction } from '$lib/utils/environment';
import type { Action, Actions } from '../$types';
import { isString } from '$lib/utils/form-validation';

import { db } from '$lib/database';

function hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

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

    const rawToken = crypto.randomUUID();
    const hashedToken = hashSessionToken(rawToken);

    await db.user.update({
        where: { username: user.username },
        data: { userAuthToken: hashedToken },
    });

    cookies.set('session', rawToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: isProduction(),
        maxAge: 60 * 60 * 24 * 30,
    });

    throw redirect(302, '/app');
};

export const actions: Actions = { login };
