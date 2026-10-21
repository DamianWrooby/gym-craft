import { createResponse } from '$lib/utils/response';
import { todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile } from '$lib/prisma/prisma';
import { editSession, sessionResponse } from '$lib/server/planner/sessions';

/** Edit a session; an AI session is superseded by an athlete row, never overwritten (story 35). */
export async function PATCH({
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
    const profile = await getAthleteProfile(params.id);
    const today = todayInTimezone(profile?.timezone ?? 'UTC');
    const outcome = await editSession(params.id, params.sessionId, body, today);
    const { status, body: payload } = sessionResponse(outcome);
    return createResponse(status, payload);
}
