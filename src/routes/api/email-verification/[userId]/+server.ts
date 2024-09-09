import { json } from '@sveltejs/kit';
import { sendVerificationToken } from '$lib/server/mail';
import { invalidatePreviousToken } from '$lib/prisma/prisma';
import to from 'await-to-js';

export async function POST({ request, params }: { request: Request; params: { userId: string } }): Promise<Response> {
    const body = await request.json();
    const email = body.email;

    if (!params.userId || !email) return json({ message: 'Bad request' }, { status: 400 });

    // mark previous token as used
    await invalidatePreviousToken(params.userId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [verificationError, _] = await to(sendVerificationToken(params.userId, email));
    if (verificationError) return json({ message: 'Verification email not sent' }, { status: 400 });

    return json({ message: 'Verification email has been sent' });
}
