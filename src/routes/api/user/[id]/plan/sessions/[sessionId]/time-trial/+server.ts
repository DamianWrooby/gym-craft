import { createResponse } from '$lib/utils/response';
import { recordTimeTrial, sessionResponse } from '$lib/server/planner/sessions';

/** Enter a time trial's result: it becomes a race result and anchors the plan (story 38). */
export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string; sessionId: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: 'Unauthorized' });

    const body = await request.json().catch(() => null);
    const outcome = await recordTimeTrial(params.id, params.sessionId, body?.timeSec);
    const { status, body: payload } = sessionResponse(outcome, true);
    return createResponse(status, payload);
}
