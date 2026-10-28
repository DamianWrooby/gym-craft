import { m } from '$lib/paraglide/messages.js';
import { createResponse } from '$lib/utils/response';
import { abandonActivePlan } from '$lib/server/planner/abandon';

/** Abandon the active plan so the athlete can start a new one (#435). Costs one plan revision. */
export async function POST({ params, locals }: { params: { id: string }; locals: App.Locals }): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: m.api_unauthorized() });

    const result = await abandonActivePlan(params.id, locals.user.subscriptionTier);
    if (result.kind === 'none') return createResponse(404, { code: 'NO_ACTIVE_PLAN', message: m.api_no_active_plan() });
    if (result.kind === 'capped') {
        return createResponse(429, { code: 'REVISION_CAP', message: m.api_abandon_capped({ cap: result.cap }) });
    }
    return createResponse(200, { data: { abandoned: true } });
}
