import { m } from '$lib/paraglide/messages.js';
import { db } from '$lib/database';
import { createResponse } from '$lib/utils/response';
import { getLimit } from '@/constants/subscription.constants';

/** Sets the account-wide AI model (ADR 0016). Only models the current tier allows are accepted. */
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
        return createResponse(403, { message: m.api_unauthorized() });
    }

    const body = await request.json().catch(() => null);
    const model = body?.model;
    const allowed = getLimit(locals.user.subscriptionTier, 'allowedModels');
    if (typeof model !== 'string' || !allowed.includes(model)) {
        return createResponse(400, { code: 'INVALID_MODEL', message: `Model must be one of: ${allowed.join(', ')}` });
    }

    await db.user.update({ where: { id: params.id }, data: { aiModelPreference: model } });
    return createResponse(200, { data: { model } });
}
