import { verifyToken } from '$lib/prisma/prisma.js';
import { error } from '@sveltejs/kit';
import { to } from 'await-to-js';

export async function load({ params }) {
		const [err] = await to(verifyToken(params.userId, params.token));

		if (err) {
			console.log(err);
			throw error(400, 'Token error');
		}

	return { status: 200, body: 'Account verified' };
}