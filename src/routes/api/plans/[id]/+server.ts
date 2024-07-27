import { json } from '@sveltejs/kit';
import { updatePlanName, deletePlan } from '$lib/prisma/prisma';
import { createErrorResponse } from '$lib/utils/error-response';
import type { Plan } from '@prisma/client';

export async function POST({ request, params }: { request: Request; params: { id: string } }): Promise<Response> {
    const body = await request.json();
    let updatedPlan;
    
    if (!params.id) {
        return createErrorResponse(404, 'Plan not found');
    }

    try {
        updatedPlan = await updatePlanName(params.id, body.name, body.userId);
    } catch (error) {
        return createErrorResponse(502, 'Database error');
    }

    return json(updatedPlan);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }): Promise<Response> {
    const body = await request.json();
    const userId = body.userId;
    let removedPlan: Plan;

    if (!userId) {
        return createErrorResponse(400, 'Invalid credentials');
    }

    if (!params.id) {
        return createErrorResponse(404, 'Plan not found');
    }

    try {
        removedPlan = await deletePlan(params.id, userId);
    } catch (error) {
        return createErrorResponse(502, (error as Error).message);
    }

    return json(removedPlan);
}
