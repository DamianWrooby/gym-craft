import { createResponse } from '$lib/utils/response';
import { retryJob, retryResponse } from '$lib/server/planner/week-job';

/** Re-open a failed week's AI request, at most twice (ADR 0016). The browser then calls the proxy. */
export async function POST({
    params,
    locals,
}: {
    request: Request;
    params: { id: string; weekId: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: 'Unauthorized' });
    return retryResponse('generation', await retryJob(params.id, params.weekId, 'generation'));
}
