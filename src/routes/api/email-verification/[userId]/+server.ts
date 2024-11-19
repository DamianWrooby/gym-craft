import { sendVerificationToken } from '$lib/server/mail';
import { invalidatePreviousToken } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';

export async function POST({ request, params }: { request: Request; params: { userId: string } }): Promise<Response> {
    const body = await request.json();
    const email = body.email;

    if (!params.userId || !email) return createResponse(400, { message: 'Bad request' });

    // mark previous token as used
    await invalidatePreviousToken(params.userId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [verificationError, _] = await to(sendVerificationToken(params.userId, email));
    if (verificationError) return createResponse(400, { message: 'Verification email not sent' });

    return createResponse(200, { message: 'Verification email has been sent' });
}
