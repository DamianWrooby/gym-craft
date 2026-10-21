import { createResponse } from '$lib/utils/response';
import { todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile } from '$lib/prisma/prisma';
import { sessionResponse } from '$lib/server/planner/sessions';
import { linkSession, unlinkSession } from '$lib/server/planner/link';

type Event = { request: Request; params: { id: string; sessionId: string }; locals: App.Locals };

async function today(userId: string): Promise<string> {
    const profile = await getAthleteProfile(userId);
    return todayInTimezone(profile?.timezone ?? 'UTC');
}

/** Link a session in the current week to an activity by hand (story 64). */
export async function POST({ request, params, locals }: Event): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: 'Unauthorized' });

    const body = await request.json().catch(() => null);
    const outcome = await linkSession(params.id, params.sessionId, body?.activityId, await today(params.id));
    const { status, body: payload } = sessionResponse(outcome);
    return createResponse(status, payload);
}

/** Undo a wrong match in the current week (story 64). */
export async function DELETE({ params, locals }: Event): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: 'Unauthorized' });

    const outcome = await unlinkSession(params.id, params.sessionId, await today(params.id));
    const { status, body: payload } = sessionResponse(outcome);
    return createResponse(status, payload);
}
