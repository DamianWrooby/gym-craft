import { saveGarminEmail } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import { createResponse } from '$lib/utils/response';

export async function POST({ request, params }: { request: Request; params: { id: string } }): Promise<Response> {
    const body = await request.json();
    const { email } = body;
    const userId = params.id;

    const [error, saved] = await to(saveGarminEmail(userId, email));
    if (error) return createResponse(400, { message: 'Cannot save Garmin data' });

    return createResponse(200, { saved });
}
