import { to } from 'await-to-js';
import type { Plan } from '@models/plan/plan.model';
import type { SurveyFormModel } from '@/models/survey/survey-form.model';

export type GeneratePlanErrorCode =
    /** The proxy rejected the GymCraft session — the user has to log in again. Never retry. */
    | 'INVALID_SESSION'
    /** The survey payload failed the proxy's Zod schema — a client bug. Never retry. */
    | 'INVALID_FORM_DATA'
    /** Anything else (network, OpenAI, proxy internals). Retrying is reasonable. */
    | 'PROXY_ERROR';

export type GeneratePlanResult = { ok: true; plan: Plan } | { ok: false; code: GeneratePlanErrorCode; message: string };

/** Codes that a retry can never fix — the caller must stop and act on them. */
export function isRetryableCode(code: GeneratePlanErrorCode): boolean {
    return code === 'PROXY_ERROR';
}

/**
 * `/api/generate-plan` is inconsistent about content types: JSON on 200/401 and on the generic
 * 500, but text/plain on the 400 and on the "Invalid response from OpenAI" 500. A bare
 * `.json()` therefore throws on exactly the responses that carry the real diagnosis, and the
 * parse error masks it. Read the body once as text and parse defensively instead.
 */
function readBody(raw: string): { json: Record<string, unknown> | null; text: string } {
    const text = raw.trim();
    if (!text) return { json: null, text: '' };
    try {
        const parsed = JSON.parse(text);
        return { json: typeof parsed === 'object' && parsed !== null ? parsed : null, text };
    } catch {
        return { json: null, text };
    }
}

function messageFrom(json: Record<string, unknown> | null, text: string, fallback: string): string {
    const candidate = json?.message ?? json?.error;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    return text || fallback;
}

/**
 * Single call to the AI proxy's plan generator. The browser talks to the proxy directly because
 * plan generation takes far longer than a Netlify function is allowed to run.
 *
 * `session` is the hashed session token the server put in page data — the proxy matches it
 * against `User.userAuthToken` and answers 401 `INVALID_SESSION` when it does not resolve.
 */
export async function generatePlan(
    url: string,
    session: string,
    formData: SurveyFormModel,
): Promise<GeneratePlanResult> {
    const [fetchError, response] = await to(
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session, formData }),
        }),
    );

    if (fetchError || !response) {
        return { ok: false, code: 'PROXY_ERROR', message: fetchError?.message ?? 'Proxy unreachable' };
    }

    const [readError, raw] = await to(response.text());
    if (readError) {
        return { ok: false, code: 'PROXY_ERROR', message: 'Could not read the proxy response' };
    }

    const { json, text } = readBody(raw ?? '');

    if (!response.ok) {
        if (response.status === 401) {
            return {
                ok: false,
                code: 'INVALID_SESSION',
                message: messageFrom(json, text, 'Session expired or invalid'),
            };
        }
        if (response.status === 400) {
            return {
                ok: false,
                code: 'INVALID_FORM_DATA',
                message: messageFrom(json, text, 'Invalid form data'),
            };
        }
        return {
            ok: false,
            code: 'PROXY_ERROR',
            message: messageFrom(json, text, `Proxy responded ${response.status}`),
        };
    }

    if (!json) {
        return { ok: false, code: 'PROXY_ERROR', message: 'Invalid proxy response' };
    }

    return { ok: true, plan: json as unknown as Plan };
}
