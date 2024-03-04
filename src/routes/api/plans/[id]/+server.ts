import { json } from '@sveltejs/kit';
import { updatePlanName } from '$lib/prisma/prisma';
import { createErrorResponse } from '$lib/utils/error-response';

export async function POST({ request, params }: { request: Request; params: { id: string } }): Promise<Response> {
    const body = await request.json();
    let updatedPlan;
    
    if (!params.id) {
        return createErrorResponse(404, 'Plan not found');
    }

    try {
        updatedPlan = await updatePlanName(params.id, body.name);
    } catch (error) {
        return createErrorResponse(502, 'Database error');
    }

    return json(updatedPlan);
}
