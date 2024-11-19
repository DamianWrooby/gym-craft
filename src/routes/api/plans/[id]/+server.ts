import { updatePlanName, deletePlan } from '$lib/prisma/prisma';
import { createResponse } from '$lib/utils/response';
import type { Plan } from '@prisma/client';

export async function POST({ request, params }: { request: Request; params: { id: string } }): Promise<Response> {
    const body = await request.json();
    let updatedPlan;
    
    if (!params.id) {
        return createResponse(404, { message: 'Plan not found' });
    }

    try {
        updatedPlan = await updatePlanName(params.id, body.name, body.userId);
    } catch (error) {
        return createResponse(502, { message: 'Database error' });
    }

    return createResponse(200, updatedPlan);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }): Promise<Response> {
    const body = await request.json();
    const userId = body.userId;
    let removedPlan: Plan;

    if (!userId) {
        return createResponse(400, { message: 'Invalid credentials' });
    }

    if (!params.id) {
        return createResponse(404, { message: 'Plan not found' });
    }

    try {
        removedPlan = await deletePlan(params.id, userId);
    } catch (error) {
        return createResponse(502, { message: (error as Error).message });
    }

    return createResponse(200, removedPlan);
}
