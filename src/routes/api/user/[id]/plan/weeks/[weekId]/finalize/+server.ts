import { createResponse } from '$lib/utils/response';
import { finalizeResponse } from '$lib/server/planner/week-job';
import { finalizeWeek } from '$lib/server/planner/week-generation';

/** Finalize a week's AI request: validate, cost and store its sessions. Idempotent (ADR 0014). */
export async function POST({
    params,
    locals,
}: {
    request: Request;
    params: { id: string; weekId: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: 'Unauthorized' });
    return finalizeResponse('generation', await finalizeWeek(params.id, params.weekId));
}
