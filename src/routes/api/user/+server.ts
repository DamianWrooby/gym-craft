import { db } from '$lib/database';
import { createResponse } from '$lib/utils/response';
import { getAuthenticatedUser } from '$lib/server/auth';
import bcrypt from 'bcrypt';
import { to } from 'await-to-js';
import type { RequestEvent } from './$types';

export async function DELETE(event: RequestEvent): Promise<Response> {
    const user = getAuthenticatedUser(event);
    const body = await event.request.json();
    const password = body.password;

    if (typeof password !== 'string' || !password) return createResponse(400, { message: 'Invalid credentials' });

    const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
    });
    if (!dbUser) return createResponse(404, { message: 'User not found' });

    const [passwordError, userPassword] = await to(bcrypt.compare(password, dbUser.passwordHash));
    if (passwordError || !userPassword) return createResponse(400, { message: 'Invalid credentials' });

    const [deleteError] = await to(db.user.delete({ where: { id: user.id } }));
    if (deleteError) return createResponse(500, { message: 'User not deleted' });

    return createResponse(200, { message: 'User deleted' });
}
