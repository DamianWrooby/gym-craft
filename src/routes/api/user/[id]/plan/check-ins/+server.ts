import { m } from '$lib/paraglide/messages.js';
import { createResponse } from '$lib/utils/response';
import { saveCheckIn } from '$lib/server/planner/check-ins';

/** Today's one-tap wellbeing check-in (story 77). */
export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: m.api_unauthorized() });

    const body = await request.json().catch(() => null);
    const saved = await saveCheckIn(params.id, body);
    if (!saved.ok) return createResponse(400, { code: 'INVALID_BODY', message: saved.error });
    return createResponse(200, { data: { saved: true } });
}
