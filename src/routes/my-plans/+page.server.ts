import { getPlans } from '$lib/prisma/prisma';

export async function load({ locals }) {
	const userId = locals?.user?.id;
	console.time('getPlans');
	const plans = await getPlans(userId);
	console.timeEnd('getPlans');
	return {
		plans,
	};
}