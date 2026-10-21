import { createResponse } from '$lib/utils/response';
import { SESSION_MARKS, markSession, sessionResponse, type SessionMark } from '$lib/server/planner/sessions';

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
    const outcome = await markSession(params.id, params.sessionId, body.status as SessionMark);
    const { status, body: payload } = sessionResponse(outcome);
    return createResponse(status, payload);
}
