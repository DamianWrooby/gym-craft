import { getGeneralPlanLimit } from '$lib/prisma/prisma';
import { createResponse } from '$lib/utils/response';
import { error } from '@sveltejs/kit';
import { to } from 'await-to-js';

export async function GET(): Promise<Response> {
    const [err, generalPlanLimit] = await to(getGeneralPlanLimit());
    if (err) throw error(500, 'Cannot get general plan limit');

    return createResponse(200, { generalPlanLimit });
}
