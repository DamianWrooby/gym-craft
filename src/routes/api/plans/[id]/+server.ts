import { updatePlanName, deletePlan } from '$lib/prisma/prisma';
import { createResponse } from '$lib/utils/response';
import { getAuthenticatedUser } from '$lib/server/auth';
import type { Plan } from '@prisma/client';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent): Promise<Response> {
    const user = getAuthenticatedUser(event);
    const body = await event.request.json();

    if (!event.params.id) {
        return createResponse(404, { message: 'Plan not found' });
    }

    try {
        await updatePlanName(event.params.id, body.name, user.id);
    } catch (error) {
        return createResponse(502, { message: 'Database error' });
    }

    return createResponse(200, { success: true });
}

export async function DELETE(event: RequestEvent): Promise<Response> {
    const user = getAuthenticatedUser(event);
    let removedPlan: Plan;

    if (!event.params.id) {
        return createResponse(404, { message: 'Plan not found' });
    }

    try {
        removedPlan = await deletePlan(event.params.id, user.id);
    } catch (error) {
        return createResponse(502, { message: 'Database error' });
    }

    return createResponse(200, removedPlan);
}
