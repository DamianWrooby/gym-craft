import { createResponse } from '$lib/utils/response';
import { SESSION_MARKS, markSession, sessionResponse, type SessionMark } from '$lib/server/planner/sessions';
import { reevaluateCurrentWeek } from '$lib/server/planner/revision';

/** Mark a session done or skipped by hand, or reopen it (story 65). */
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
    if (!SESSION_MARKS.includes(body?.status)) {
        return createResponse(400, { code: 'INVALID_BODY', message: 'Mark the session done, skipped or planned' });
    }
    const mark = body.status as SessionMark;
    const outcome = await markSession(params.id, params.sessionId, mark);
    // A completed or skipped session re-evaluates the rest of the week (story 68). Best effort:
    // the mark stands even when the re-evaluation fails.
    if (outcome.kind === 'saved' && mark !== 'PLANNED') {
        try {
            const trigger = mark === 'DONE' ? 'SESSION_DONE' : 'SESSION_SKIPPED';
            await reevaluateCurrentWeek(params.id, trigger, { plannedSessionId: params.sessionId });
        } catch (e) {
            console.error('Re-evaluating the plan week after a session mark failed', e);
        }
    }
    const { status, body: payload } = sessionResponse(outcome);
    return createResponse(status, payload);
}
