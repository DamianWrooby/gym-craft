import { fail, redirect, error } from '@sveltejs/kit';
import type { Action, Actions } from '../$types';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { sendVerificationToken } from '$lib/server/mail';
import { isProduction } from '$lib/utils/environment';
import { validateRegisterFormData, isString } from '$lib/utils/form-validation';
import { to } from 'await-to-js';

import { db } from '$lib/database';

const register: Action = async ({ request }) => {
    const data = await request.formData();
    const username = data.get('username');
    const email = data.get('email');
    const password = data.get('password');
    const confirmPassword = data.get('confirmPassword');
    const termsOfUse = !!data.get('termsOfUse');
    const marketingAgreement = !!data.get('marketingAgreement');

    if (!isString(username) || !isString(email) || !isString(password) || !isString(confirmPassword)) {
        return fail(400, { invalidEntry: true });
    }

    if (!termsOfUse) return fail(400, { termsOfUse: true });;

    const validationError = validateRegisterFormData({ username, email, password, confirmPassword });
    if (validationError) return fail(400, validationError);

    const userExists = await db.user.findUnique({
        where: { username },
        select: { username: true },
    });
    if (userExists) return fail(400, { userExists: true });

    if (isProduction()) {
        const emailExists = await db.user.findFirst({
            where: { email },
            select: { email: true },
        });
        if (emailExists) return fail(400, { emailExists: true });
    }

    const existingRole = await db.roles.findUnique({ where: { name: Role.USER } });
    if (!existingRole) await db.roles.create({ data: { name: Role.USER } });

    const createdUser = await db.user.create({
        data: {
            username,
            email,
            emailVerified: false,
            marketingAgreement,
            passwordHash: await bcrypt.hash(password, 10),
            userAuthToken: crypto.randomUUID(),
            role: { connect: { name: Role.USER } },
        },
    });


    const [err, verificationToken] = await to(sendVerificationToken(createdUser.id, createdUser.email));
    if (err) throw error(500, 'Verification email not sent');
    if (verificationToken)  throw redirect(303, '/verification-mail-sent');
};

export const actions: Actions = { register };
