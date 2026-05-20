import { to } from 'await-to-js';
import { appConfig } from '@/constants/app.constants';
import { isProduction } from '$lib/utils/environment';
import type { ReportPrompt } from './build-prompt';
import type { ExplainPrompt } from './explain-activity';

export interface CallProxyResult {
    ok: boolean;
    summary?: string;
    error?: string;
}

export interface CallExplainProxyResult {
    ok: boolean;
    analysis?: string;
    error?: string;
}

const PROXY_TIMEOUT_MS = 60_000;

export async function callWeeklyReportProxy(prompt: ReportPrompt): Promise<CallProxyResult> {
    const url = isProduction() ? appConfig.weeklyReportApiUrlPROD : appConfig.weeklyReportApiUrlDEV;
    const result = await postPrompt(url, prompt);
    if (!result.ok) return { ok: false, error: result.error };

    const summary = typeof result.data?.summary === 'string' ? result.data.summary.trim() : null;
    if (!summary) return { ok: false, error: 'Empty proxy summary' };
    return { ok: true, summary };
}

export async function callExplainRunProxy(prompt: ExplainPrompt): Promise<CallExplainProxyResult> {
    const url = isProduction() ? appConfig.explainRunApiUrlPROD : appConfig.explainRunApiUrlDEV;
    const result = await postPrompt(url, prompt);
    if (!result.ok) return { ok: false, error: result.error };

    const analysis = typeof result.data?.analysis === 'string' ? result.data.analysis.trim() : null;
    if (!analysis) return { ok: false, error: 'Empty proxy analysis' };
    return { ok: true, analysis };
}

async function postPrompt(
    url: string,
    prompt: { system: string; user: string },
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    const [error, response] = await to(
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: prompt.system, user: prompt.user }),
            signal: controller.signal,
        }),
    );

    clearTimeout(timeout);

    if (error || !response) {
        return { ok: false, error: error?.message ?? 'Proxy unreachable' };
    }
    if (!response.ok) {
        return { ok: false, error: `Proxy responded ${response.status}` };
    }

    const [parseError, data] = await to(response.json());
    if (parseError) return { ok: false, error: 'Invalid proxy response' };
    return { ok: true, data: data as Record<string, unknown> };
}
