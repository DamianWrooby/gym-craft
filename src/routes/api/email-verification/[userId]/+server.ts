import { json } from '@sveltejs/kit';
import { sendVerificationToken } from '$lib/server/mail';
import { invalidatePreviousToken } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import { createErrorResponse } from '$lib/utils/error-response';
import { createResponse } from '$lib/utils/response';

export async function POST({ request, params }: { request: Request; params: { userId: string } }): Promise<Response> {
    const body = await request.json();
    const email = body.email;

    if (!params.userId || !email) return json({ message: 'Bad request' }, { status: 400 });

    // mark previous token as used
    await invalidatePreviousToken(params.userId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [verificationError, _] = await to(sendVerificationToken(params.userId, email));
    if (verificationError) return createErrorResponse(400, 'Verification email not sent');

    return createResponse(200, 'Verification email has been sent');
}
