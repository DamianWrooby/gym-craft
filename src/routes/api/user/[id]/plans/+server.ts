import { getPlans } from '$lib/prisma/prisma';
import { createResponse } from '$lib/utils/response';

export async function GET({ params }: { params: { id: string } }): Promise<Response> {
    const userId = params.id;

    const plans = await getPlans(userId);

    if (!plans) {
        return createResponse(404, { message: 'Plans not found' });
    }

    return createResponse(200, { plans });
}
