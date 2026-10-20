import { createResponse } from '$lib/utils/response';
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

    const outcome = await finalizeWeek(params.id, params.weekId);
    switch (outcome.kind) {
        case 'not-found':
            return createResponse(404, { code: 'NOT_FOUND', message: 'Plan week not found' });
        case 'generated':
            return createResponse(200, { data: { generation: 'GENERATED' } });
        case 'pending':
            return createResponse(202, { data: { generation: 'PENDING', requestStatus: outcome.requestStatus } });
        case 'failed':
            return createResponse(200, { data: { generation: 'FAILED', retriesLeft: outcome.retriesLeft } });
    }
}
