import { json } from '@sveltejs/kit';

export const createResponse = (status: number, message: string) => json({ message }, { status });