import { createResponse } from '$lib/utils/response';
import { todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile } from '$lib/prisma/prisma';
import { addSession, sessionResponse } from '$lib/server/planner/sessions';

/** Add a session of any kind to the active plan, costed before it happens (stories 33–34). */
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
    const profile = await getAthleteProfile(params.id);
    const outcome = await addSession(params.id, body, todayInTimezone(profile?.timezone ?? 'UTC'));
    const { status, body: payload } = sessionResponse(outcome, true);
    return createResponse(status, payload);
}
