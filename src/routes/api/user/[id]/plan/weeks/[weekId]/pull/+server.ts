import { createResponse } from '$lib/utils/response';
import { todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile } from '$lib/prisma/prisma';
import { getLimit } from '@/constants/subscription.constants';
import { WEEK_OUTLOOKS, type WeekOutlook } from '$lib/planner/core/pull';
import { pullWeek, type PullInput } from '$lib/server/planner/pull';

const MAX_CONFIRMATIONS = 50;

function validate(body: unknown): PullInput | null {
    const { outlook, confirmations } = (body ?? {}) as Record<string, unknown>;
    if (!WEEK_OUTLOOKS.includes(outlook as WeekOutlook)) return null;
    if (!Array.isArray(confirmations) || confirmations.length > MAX_CONFIRMATIONS) return null;
    const valid = confirmations.every(
        (c) => typeof c?.sessionId === 'string' && (c.status === 'DONE' || c.status === 'SKIPPED'),
    );
    return valid ? { outlook: outlook as WeekOutlook, confirmations } : null;
}

/** Pull: write the AI request for the next unwritten week (ADR 0016). Logged, never capped. */
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

    const input = validate(await request.json().catch(() => null));
    if (!input) return createResponse(400, { code: 'INVALID_BODY', message: 'Choose an outlook for next week' });

    const profile = await getAthleteProfile(params.id);
    const today = todayInTimezone(profile?.timezone ?? 'UTC');
    const model = getLimit(locals.user?.subscriptionTier ?? 'FREE', 'aiModel');

    const outcome = await pullWeek(params.id, params.weekId, input, model, today);
    switch (outcome.kind) {
        case 'no-plan':
            return createResponse(404, { code: 'NOT_FOUND', message: 'No active plan' });
        case 'not-pullable':
            return createResponse(409, { code: 'NOT_PULLABLE', message: 'This week cannot be written yet' });
        case 'already-pulled':
            return createResponse(409, { code: 'ALREADY_PULLED', message: 'This week is already being written' });
        case 'pulled':
            return createResponse(201, { data: { weekId: outcome.weekId, aiRequestId: outcome.aiRequestId } });
    }
}
