import { getPlans } from '$lib/prisma/prisma';
import { createErrorResponse } from '$lib/utils/error-response';
import { json } from '@sveltejs/kit';

export async function GET({ params }: { params: { id: string } }): Promise<Response> {
    const userId = params.id;

    const plans = await getPlans(userId);

    if (!plans) {
        return createErrorResponse(404, 'Plans not found');
    }

    return json(plans);
}
