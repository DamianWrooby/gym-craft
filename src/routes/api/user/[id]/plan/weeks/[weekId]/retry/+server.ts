import { createResponse } from '$lib/utils/response';
import { MAX_RETRIES, retryWeek } from '$lib/server/planner/week-generation';

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

    const outcome = await retryWeek(params.id, params.weekId);
    switch (outcome.kind) {
        case 'not-found':
            return createResponse(404, { code: 'NOT_FOUND', message: 'Plan week not found' });
        case 'not-failed':
            return createResponse(409, { code: 'NOT_FAILED', message: 'Only a failed week can be retried' });
        case 'limit':
            return createResponse(429, {
                code: 'RETRY_LIMIT',
                message: `This week was already retried ${MAX_RETRIES} times`,
            });
        case 'retrying':
            return createResponse(200, {
                data: { aiRequestId: outcome.aiRequestId, retriesLeft: outcome.retriesLeft },
            });
    }
}
