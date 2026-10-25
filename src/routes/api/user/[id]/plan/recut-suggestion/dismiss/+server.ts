import { m } from '$lib/paraglide/messages.js';
import { createResponse } from '$lib/utils/response';
import { getActivePlan } from '$lib/server/planner/repository';
import { dismissRecutSuggestion } from '$lib/server/planner/check-ins';

/** Dismiss the recut suggestion (story 79); it returns only if drift continues into a new week. */
export async function POST({ params, locals }: { params: { id: string }; locals: App.Locals }): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: m.api_unauthorized() });

    const plan = await getActivePlan(params.id);
    if (!plan || !(await dismissRecutSuggestion(params.id, plan))) {
        return createResponse(404, { code: 'NO_DRIFT', message: m.api_no_recut_suggestion() });
    }
    return createResponse(200, { data: { dismissed: true } });
}
