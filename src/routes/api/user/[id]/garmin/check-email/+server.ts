import { getGarminEmail } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';
import { assertOwnership } from '$lib/server/auth';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent): Promise<Response> {
    const user = assertOwnership(event, event.params.id);

    const [error, email] = await to(getGarminEmail(user.id));
    if (error) return createResponse(400, { message: 'Cannot retrieve information about user' });

    return createResponse(200, { email });
}
