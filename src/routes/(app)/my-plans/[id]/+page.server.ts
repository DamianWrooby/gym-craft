import { getPlan } from '$lib/prisma/prisma';

export async function load({ locals, params }) {
	const userId = locals?.user?.id;
	return {
		plan: await getPlan(params.id, userId),
	};
}