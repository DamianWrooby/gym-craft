import { createResponse } from '$lib/utils/response';
import { archiveRunningGoal, updateRunningGoal, type RunningGoalUpdateInput } from '$lib/prisma/prisma';
import { validateRunningGoalInput } from '$lib/server/running-goals/validation';

export async function PUT({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string; goalId: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }

    const body = await request.json();
    const validation = validateRunningGoalInput(body, { partial: true });
    if ('error' in validation) {
        return createResponse(400, { code: 'INVALID_BODY', message: validation.error });
    }

    const updated = await updateRunningGoal(params.goalId, params.id, validation.input as RunningGoalUpdateInput);
    if (!updated) {
        return createResponse(404, { code: 'GOAL_NOT_FOUND', message: 'Goal not found' });
    }
    return createResponse(200, { data: updated });
}

export async function DELETE({
    params,
    locals,
}: {
    params: { id: string; goalId: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }

    const archived = await archiveRunningGoal(params.goalId, params.id);
    if (!archived) {
        return createResponse(404, { code: 'GOAL_NOT_FOUND', message: 'Goal not found or already archived' });
    }
    return createResponse(200, { data: { archived: true } });
}
