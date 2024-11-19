import { db } from '$lib/database';
import { createResponse } from '$lib/utils/response';
import bcrypt from 'bcrypt';
import { to } from 'await-to-js';

export async function DELETE({ request }: { request: Request }): Promise<Response> {
    const body = await request.json();
    const userId = body.userId;
    const password = body.password;

    if (typeof userId !== 'string' || typeof password !== 'string' || !userId || !password)
        return createResponse(400, { message: 'Invalid credentials' });

    const dbUser = await db.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
    });
    if (!dbUser) return createResponse(404, { message: 'User not found' });

    const [passwordError, userPassword] = await to(bcrypt.compare(password, dbUser.passwordHash));
    if (passwordError || !userPassword) return createResponse(400, { message: 'Invalid credentials' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [deleteError, _] = await to(db.user.delete({ where: { id: userId } }));
    console.log(deleteError);
    if (deleteError) return createResponse(500, { message: 'User not deleted' });

    return createResponse(200, { message: 'User deleted' });
}
