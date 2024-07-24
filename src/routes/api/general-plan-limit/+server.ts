import { getGeneralPlanLimit } from '$lib/prisma/prisma';
import { json } from '@sveltejs/kit';

export async function GET(): Promise<Response> {
    const generalPlanLimit = await getGeneralPlanLimit();
    const responseBody = {
        generalPlanLimit,
    };

    return json(responseBody);
}
