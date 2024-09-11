import { db } from '$lib/database';
import { createErrorResponse } from '$lib/utils/error-response';
import { createResponse } from '$lib/utils/response';
import bcrypt from 'bcrypt';
import to from 'await-to-js';

export async function DELETE({ request }: { request: Request }): Promise<Response> {
    const body = await request.json();
    const userId = body.userId;
    const password = body.password;

    if (typeof userId !== 'string' || typeof password !== 'string' || !userId || !password)
        return createErrorResponse(400, 'Invalid credentials');

    const dbUser = await db.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
    });
    if (!dbUser) return createErrorResponse(404, 'User not found');

    const [passwordError, userPassword] = await to(bcrypt.compare(password, dbUser.passwordHash));
    if (passwordError || !userPassword) return createErrorResponse(400, 'Invalid credentials');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [deleteError, _] = await to(db.user.delete({ where: { id: userId } }));
    console.log(deleteError);
    if (deleteError) return createErrorResponse(500, 'User not deleted');

    return createResponse(200, 'User deleted');
}
