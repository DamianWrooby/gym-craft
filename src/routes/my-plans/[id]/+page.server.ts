import { getPlan } from '$lib/prisma/prisma';

export const csr = true;
export const ssr = false;

export async function load({ locals, params }) {
	const userId = locals?.user?.id;
	return {
		plan: await getPlan(params.id, userId),
	};
}