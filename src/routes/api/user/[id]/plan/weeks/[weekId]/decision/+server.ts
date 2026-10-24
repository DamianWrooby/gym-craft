import { createResponse } from '$lib/utils/response';
import { answerDecision } from '$lib/server/planner/decision';
import { DECISION_OPTIONS, type DecisionOption } from '$lib/planner/core/conflict';

/**
 * Answer a pending ask: drop or downgrade the key session, or keep the week over budget (ADR 0013).
 * A placement ask (story 60) takes drop or rewrite.
 */
export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string; weekId: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: 'Unauthorized' });

    const body = await request.json().catch(() => null);
    const choice = body?.choice;
    if (!DECISION_OPTIONS.includes(choice)) {
        return createResponse(400, { code: 'INVALID_BODY', message: 'Choose drop, downgrade, keep or rewrite' });
    }

    const outcome = await answerDecision(params.id, params.weekId, choice as DecisionOption);
    switch (outcome.kind) {
        case 'not-found':
            return createResponse(404, { code: 'NOT_FOUND', message: 'Plan week not found' });
        case 'no-ask':
            return createResponse(409, { code: 'NO_PENDING_DECISION', message: 'This week has no open question' });
        case 'not-offered':
            return createResponse(400, { code: 'NOT_OFFERED', message: 'That choice was not offered for this week' });
        case 'answered':
            return createResponse(200, { data: { decision: outcome.decision } });
        case 'rewrite':
            return createResponse(200, { data: { decision: null, generation: 'FAILED' } });
    }
}
