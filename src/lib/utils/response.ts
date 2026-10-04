import { json } from '@sveltejs/kit';

type ResponseData = Record<string, unknown>;

export const createResponse = (status: number, data: ResponseData) => json(data, { status });

/*
 * Error-handling pattern for API routes (#179)
 *
 * 1. Wrap every awaited call that can fail with `to()` from `await-to-js`.
 *    Check the error tuple right away and return early; no try/catch blocks.
 *
 *        const [dbError, plan] = await to(deletePlan(id, user.id));
 *        if (dbError) return apiError(502, 'Database error');
 *
 * 2. Expected failures (bad input, caps, upstream errors) return `apiError()`.
 *    The body is always `{ message, code? }`, so clients read `body.message`.
 * 3. Auth and ownership failures throw SvelteKit's `error()` through
 *    `getAuthenticatedUser()` / `assertOwnership()` in `$lib/server/auth`.
 * 4. Form actions keep using SvelteKit's `fail()`; this helper is for `+server.ts` only.
 * 5. Read JSON bodies with `readJson()` so a malformed body is a 400, not a 500.
 *
 * Migrated so far: `src/routes/api/plans/**`. Other routes still use ad-hoc
 * try/catch; migrate them one route group per PR.
 */
export const apiError = (status: number, message: string, code?: string) =>
    createResponse(status, code ? { message, code } : { message });

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
    try {
        return (await request.json()) as T;
    } catch {
        return null;
    }
}
