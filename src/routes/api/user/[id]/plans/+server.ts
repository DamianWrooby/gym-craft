import { getPlans } from '$lib/prisma/prisma';
import { createErrorResponse } from '$lib/utils/error-response';
import { json } from '@sveltejs/kit';

export async function GET({ params }: { params: { userId: string } }): Promise<Response> {
	// TODO: add authentication
    const userId = params.userId;

    const plans = await getPlans(userId);

    if (!plans) {
        return createErrorResponse(404, 'Plans not found');
    }

    return json(plans);
}
