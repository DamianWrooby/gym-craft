import { m } from '$lib/paraglide/messages.js';
import { createResponse } from '$lib/utils/response';
import { dismissCheckInProposal } from '$lib/server/planner/check-ins';

/** Dismiss the check-in revision proposal (story 78); new poor days may propose again. */
export async function POST({ params, locals }: { params: { id: string }; locals: App.Locals }): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: m.api_unauthorized() });

    if (!(await dismissCheckInProposal(params.id))) {
        return createResponse(404, { code: 'NO_WEEK', message: m.api_no_week_today() });
    }
    return createResponse(200, { data: { dismissed: true } });
}
