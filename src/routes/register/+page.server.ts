import { fail, redirect } from '@sveltejs/kit';
import type { Action, Actions } from './$types';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { validatePasswordComplexity } from '$lib/utils/form-validation';

import { db } from '$lib/database';

const register: Action = async ({ request }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');
    const confirmPassword = data.get('confirmPassword');
    const existingRole = await db.roles.findUnique({ where: { name: Role.USER } });

    if (
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        typeof confirmPassword !== 'string' ||
        !username ||
        !password ||
        !confirmPassword
    ) {
        return fail(400, { invalidEntry: true });
    }

    if (password !== confirmPassword) {
        return fail(400, { passwordsExact: true });
    }

    const user = await db.user.findUnique({
        where: { username },
    });

    if (user) {
        return fail(400, { userExists: true });
    }

    if (!validatePasswordComplexity(password)) {
        return fail(400, { passwordComplexity: true });
    }

    if (!existingRole) {
        await db.roles.create({ data: { name: Role.USER } });
    }

    await db.user.create({
        data: {
            username,
            passwordHash: await bcrypt.hash(password, 10),
            userAuthToken: crypto.randomUUID(),
            role: { connect: { name: Role.USER } },
        },
    });

    throw redirect(303, '/login');
};

export const actions: Actions = { register };
