import { getGarminEmail } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';

export async function GET({ params }: { params: { id: string } }): Promise<Response> {
    const userId = params.id;

    const [error, email] = await to(getGarminEmail(userId));
    if (error) return createResponse(400, { message: 'Cannot retrieve information about user' });

    return createResponse(200, { email });
}
