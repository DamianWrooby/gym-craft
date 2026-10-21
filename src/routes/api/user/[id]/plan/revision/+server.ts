import { createResponse } from '$lib/utils/response';
import { reevaluateCurrentWeek } from '$lib/server/planner/revision';

/** Athlete-confirmed triggers; sync and session marks re-evaluate on their own (ADR 0015). */
const ATHLETE_TRIGGERS = ['ATHLETE', 'CHECK_IN'] as const;

/** Request a revision of the rest of the current week (stories 72, 78). The browser then runs it. */
export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: 'Unauthorized' });

    const body = await request.json().catch(() => null);
    const trigger = body?.trigger;
    if (!ATHLETE_TRIGGERS.includes(trigger)) {
        return createResponse(400, { code: 'INVALID_BODY', message: 'trigger must be ATHLETE or CHECK_IN' });
    }

    const outcome = await reevaluateCurrentWeek(params.id, trigger);
    switch (outcome.kind) {
        case 'no-week':
            return createResponse(404, { code: 'NO_WEEK', message: 'No written week is running today' });
        case 'in-flight':
            return createResponse(409, { code: 'IN_FLIGHT', message: 'A revision of this week is already running' });
        default:
            return createResponse(200, { data: outcome });
    }
}
