import { db } from '$lib/database';

export async function load() {
	return {
		plans: await db.plan.findMany(),
	};
}