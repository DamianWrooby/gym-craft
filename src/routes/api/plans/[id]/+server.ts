import { updatePlanName, deletePlan } from '$lib/prisma/prisma';
import { apiError, createResponse, readJson } from '$lib/utils/response';
import { getAuthenticatedUser } from '$lib/server/auth';
import { to } from 'await-to-js';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent): Promise<Response> {
    const user = getAuthenticatedUser(event);
    if (!event.params.id) return apiError(404, 'Plan not found');

    const body = await readJson<{ name?: unknown }>(event.request);
    if (typeof body?.name !== 'string' || !body.name.trim()) return apiError(400, 'Plan name is required');

    const [dbError] = await to(updatePlanName(event.params.id, body.name, user.id));
    if (dbError) return apiError(502, 'Database error');

    return createResponse(200, { success: true });
}

export async function DELETE(event: RequestEvent): Promise<Response> {
    const user = getAuthenticatedUser(event);
    if (!event.params.id) return apiError(404, 'Plan not found');

    const [dbError, removedPlan] = await to(deletePlan(event.params.id, user.id));
    if (dbError || !removedPlan) return apiError(502, 'Database error');

    return createResponse(200, removedPlan);
}
