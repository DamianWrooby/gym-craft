import { createResponse } from '$lib/utils/response';
import { getAthleteProfile, upsertAthleteProfile } from '$lib/prisma/prisma';
import { validateAthleteProfileInput } from '$lib/server/athlete-profile/validation';

export async function GET({
    params,
    locals,
}: {
    params: { id: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }

    const profile = await getAthleteProfile(params.id);
    return createResponse(200, { data: profile });
}

export async function PUT({
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
    const validation = validateAthleteProfileInput(body);
    if ('error' in validation) {
        return createResponse(400, { code: 'INVALID_BODY', message: validation.error });
    }

    const profile = await upsertAthleteProfile(params.id, validation.input);
    return createResponse(200, { data: profile });
}
