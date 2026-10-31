import { m } from '$lib/paraglide/messages.js';
import { sendVerificationToken } from '$lib/server/mail';
import { invalidatePreviousToken } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';
import { assertOwnership } from '$lib/server/auth';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent): Promise<Response> {
    const user = assertOwnership(event, event.params.userId);
    const body = await event.request.json();
    const email = body.email;

    if (!email) return createResponse(400, { message: 'Bad request' });

    // mark previous token as used
    await invalidatePreviousToken(user.id);

    const [verificationError] = await to(sendVerificationToken(user.id, email));
    if (verificationError) return createResponse(400, { message: m.api_verify_not_sent() });

    return createResponse(200, { message: m.home_verify_sent() });
}
