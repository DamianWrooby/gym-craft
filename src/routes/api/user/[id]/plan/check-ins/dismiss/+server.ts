import { createResponse } from '$lib/utils/response';
import { dismissCheckInProposal } from '$lib/server/planner/check-ins';

/** Dismiss the check-in revision proposal (story 78); new poor days may propose again. */
export async function POST({ params, locals }: { params: { id: string }; locals: App.Locals }): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: 'Unauthorized' });

    if (!(await dismissCheckInProposal(params.id))) {
        return createResponse(404, { code: 'NO_WEEK', message: 'No plan week is running today' });
    }
    return createResponse(200, { data: { dismissed: true } });
}
