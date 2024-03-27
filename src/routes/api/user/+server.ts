import { db } from '$lib/database';
import { createErrorResponse } from '$lib/utils/error-response';
import bcrypt from 'bcrypt';
import { json } from '@sveltejs/kit';

export async function DELETE({ request }: { request: Request }): Promise<Response> {
    const body = await request.json();
    const userId = body.userId;
    const password = body.password;

    if (typeof userId !== 'string' || typeof password !== 'string' || !userId || !password) {
        return createErrorResponse(400, 'Invalid credentials');
    }

    const dbUser = await db.user.findUnique({ where: { id: userId } });

    if (!dbUser) {
        return createErrorResponse(404, 'User not found');
    }

    const userPassword = await bcrypt.compare(password, dbUser.passwordHash);

    if (!userPassword) {
        return createErrorResponse(400, 'Invalid credentials');
    }

    const responseBody = {
        message: 'User deleted',
    };

    return json(responseBody);
}
