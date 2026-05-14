import { getPlan } from '$lib/prisma/prisma';
import { error } from '@sveltejs/kit';
import { to } from 'await-to-js';

export async function load({ locals, params }) {
    const userId = locals?.user?.id;
    const [err, plan] = await to(getPlan(params.id, userId));
    if (err) throw error(500, 'Cannot retrieve plan');

    return {
        plan,
    };
}
