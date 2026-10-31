/**
 * Client half of the API error pattern (#179; server half: `apiError()` in `response.ts`).
 *
 * API routes answer failures with `{ message, code? }`. Read that shape here instead of parsing
 * each response by hand: a non-JSON or empty body falls back to `fallback`, never throws.
 */
export type ApiError = { message: string; code?: string };

export async function readApiError(response: Response, fallback: string): Promise<ApiError> {
    const body: unknown = await response.json().catch(() => null);
    const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const message = typeof record.message === 'string' && record.message.trim() ? record.message : fallback;
    return typeof record.code === 'string' ? { message, code: record.code } : { message };
}
