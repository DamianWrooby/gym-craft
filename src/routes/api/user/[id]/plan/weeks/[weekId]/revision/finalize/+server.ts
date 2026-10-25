import { createResponse } from '$lib/utils/response';
import { finalizeResponse } from '$lib/server/planner/week-job';
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
    return finalizeResponse('revision', await finalizeRevision(params.id, params.weekId));
}
