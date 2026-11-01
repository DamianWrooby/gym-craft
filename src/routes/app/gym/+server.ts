import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Strength sessions live in the plan, so the old gym address goes there (ADR 0030). */
export const GET: RequestHandler = () => {
    redirect(301, '/app/plan');
};
