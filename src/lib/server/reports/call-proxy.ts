import { to } from 'await-to-js';
import { appConfig } from '@/constants/app.constants';
import { isProduction } from '$lib/utils/environment';
import type { ReportPrompt } from './build-prompt';
import type { ExplainPrompt } from './explain-activity';

export interface CallProxyResult {
    ok: boolean;
    summary?: string;
    /** Diagnostic text for the server log — never user-facing copy (it passes OpenAI's own wording through). */
    error?: string;
}

export interface CallExplainProxyResult {
    ok: boolean;
    analysis?: string;
    error?: string;
}

/** The proxy aborts its OpenAI call at 45s; stay comfortably above that so we read its answer. */
const PROXY_TIMEOUT_MS = 60_000;

/** 502 (OpenAI failed/timed out) and 503 (upstream rate limit) are transient — one retry each. */
const RETRYABLE_STATUSES = new Set([502, 503]);
const MAX_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 1_000;

/**
 * A retry is only worth starting when there is time left for it. These calls run inside a
 * SvelteKit function with its own platform ceiling, so a first attempt that already burned the
 * budget (typically the proxy's own 45s timeout) must fail fast rather than double the wait.
 */
const RETRY_BUDGET_MS = 25_000;

export async function callWeeklyReportProxy(prompt: ReportPrompt, model?: string): Promise<CallProxyResult> {
    const url = isProduction() ? appConfig.weeklyReportApiUrlPROD : appConfig.weeklyReportApiUrlDEV;
    const result = await postPrompt(url, prompt, model, 'weekly-report');
    if (!result.ok) return { ok: false, error: result.error };

    const summary = typeof result.data?.summary === 'string' ? result.data.summary.trim() : null;
    if (!summary) return { ok: false, error: 'Empty proxy summary' };
    return { ok: true, summary };
}

export async function callExplainRunProxy(prompt: ExplainPrompt, model?: string): Promise<CallExplainProxyResult> {
    const url = isProduction() ? appConfig.explainRunApiUrlPROD : appConfig.explainRunApiUrlDEV;
    const result = await postPrompt(url, prompt, model, 'explain-run');
    if (!result.ok) return { ok: false, error: result.error };

    const analysis = typeof result.data?.analysis === 'string' ? result.data.analysis.trim() : null;
    if (!analysis) return { ok: false, error: 'Empty proxy analysis' };
    return { ok: true, analysis };
}

type PostPromptResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string; retryable: boolean };

async function postPrompt(
    url: string,
    prompt: { system: string; user: string },
    model: string | undefined,
    tag: string,
): Promise<PostPromptResult> {
    const start = Date.now();
    let last: PostPromptResult = { ok: false, error: 'Proxy was not called', retryable: false };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        last = await postPromptOnce(url, prompt, model);
        if (last.ok || !last.retryable) return last;

        const elapsed = Date.now() - start;
        if (attempt === MAX_ATTEMPTS || elapsed > RETRY_BUDGET_MS) {
            console.warn(`[${tag}] giving up after ${attempt} attempt(s) in ${elapsed}ms: ${last.error}`);
            return last;
        }

        console.warn(`[${tag}] attempt ${attempt} failed (${last.error}) — retrying in ${RETRY_BACKOFF_MS}ms`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    }

    return last;
}

async function postPromptOnce(
    url: string,
    prompt: { system: string; user: string },
    model?: string,
): Promise<PostPromptResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    const [error, response] = await to(
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: prompt.system, user: prompt.user, ...(model ? { model } : {}) }),
            signal: controller.signal,
        }),
    );

    clearTimeout(timeout);

    if (error || !response) {
        // A network fault or our own abort — the proxy may well answer on the next try.
        return { ok: false, error: error?.message ?? 'Proxy unreachable', retryable: true };
    }

    const [readError, raw] = await to(response.text());
    const payload = readError ? null : parseJson(raw ?? '');

    if (!response.ok) {
        const detail = typeof payload?.error === 'string' ? payload.error : `HTTP ${response.status}`;
        return {
            ok: false,
            error: `Proxy responded ${response.status}: ${detail}`,
            retryable: RETRYABLE_STATUSES.has(response.status),
        };
    }

    if (!payload) return { ok: false, error: 'Invalid proxy response', retryable: false };
    return { ok: true, data: payload };
}

function parseJson(raw: string): Record<string, unknown> | null {
    if (!raw.trim()) return null;
    try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
        // Not JSON — an edge/proxy error page rather than the app's own answer.
        return null;
    }
}
