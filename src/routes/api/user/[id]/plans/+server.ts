import { getPlans } from '$lib/prisma/prisma';
import { createResponse } from '$lib/utils/response';
import { assertOwnership } from '$lib/server/auth';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent): Promise<Response> {
    const user = assertOwnership(event, event.params.id);

    const plans = await getPlans(user.id);

    if (!plans) {
        return createResponse(404, { message: 'Plans not found' });
    }

    return createResponse(200, { plans });
}
