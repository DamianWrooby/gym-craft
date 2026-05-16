import { createResponse } from '$lib/utils/response';
import { createRunningGoal, getRunningGoals, type RunningGoalCreateInput } from '$lib/prisma/prisma';
import { validateRunningGoalInput } from '$lib/server/running-goals/validation';

export async function GET({
    params,
    locals,
    url,
}: {
    params: { id: string };
    locals: App.Locals;
    url: URL;
}): Promise<Response> {
    if (params.id !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }
    const includeArchived = url.searchParams.get('includeArchived') === 'true';
    const goals = await getRunningGoals(params.id, { includeArchived });
    return createResponse(200, { data: goals });
}

export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }

    const body = await request.json();
    const validation = validateRunningGoalInput(body, { partial: false });
    if ('error' in validation) {
        return createResponse(400, { code: 'INVALID_BODY', message: validation.error });
    }

    const goal = await createRunningGoal(params.id, validation.input as RunningGoalCreateInput);
    return createResponse(201, { data: goal });
}

