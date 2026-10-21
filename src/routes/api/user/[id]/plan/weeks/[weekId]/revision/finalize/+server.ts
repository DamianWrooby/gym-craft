import { createResponse } from '$lib/utils/response';
import { finalizeRevision } from '$lib/server/planner/revision';

/** Finalize a revision's AI request: supersede and store the rewritten sessions. Idempotent (ADR 0015). */
export async function POST({
    params,
    locals,
}: {
    request: Request;
    params: { id: string; weekId: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: 'Unauthorized' });

    const outcome = await finalizeRevision(params.id, params.weekId);
    switch (outcome.kind) {
        case 'not-found':
            return createResponse(404, { code: 'NOT_FOUND', message: 'Plan week not found' });
        case 'generated':
            return createResponse(200, { data: { revision: 'GENERATED' } });
        case 'pending':
            return createResponse(202, { data: { revision: 'PENDING', requestStatus: outcome.requestStatus } });
        case 'failed':
            return createResponse(200, { data: { revision: 'FAILED', retriesLeft: outcome.retriesLeft } });
    }
}
