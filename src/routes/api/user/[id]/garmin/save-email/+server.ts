import { saveGarminEmail } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';
import { assertOwnership } from '$lib/server/auth';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent): Promise<Response> {
    const user = assertOwnership(event, event.params.id);
    const body = await event.request.json();
    const { email } = body;

    const [error, saved] = await to(saveGarminEmail(user.id, email));
    if (error) return createResponse(400, { message: 'Cannot save Garmin data' });

    return createResponse(200, { saved });
}
