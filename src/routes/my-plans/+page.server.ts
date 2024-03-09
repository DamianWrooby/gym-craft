import { getPlans } from '$lib/prisma/prisma';

export async function load({ locals }) {
	const userId = locals?.user?.id;
	return {
		plans: await getPlans(userId),
	};
}