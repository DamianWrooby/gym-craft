import { json } from '@sveltejs/kit';

export const createErrorResponse = (status: number, message: string) => json({ message }, { status });