import { json } from '@sveltejs/kit';

type ResponseData = Record<string, unknown>;

export const createResponse = (status: number, data: ResponseData) => json(data, { status });