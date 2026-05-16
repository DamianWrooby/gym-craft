import { to } from 'await-to-js';
import { appConfig } from '@/constants/app.constants';
import { isProduction } from '$lib/utils/environment';
import type { ReportPrompt } from './build-prompt';

export interface CallProxyResult {
    ok: boolean;
    summary?: string;
    error?: string;
}

const WEEKLY_REPORT_TIMEOUT_MS = 60_000;

export async function callWeeklyReportProxy(prompt: ReportPrompt): Promise<CallProxyResult> {
    const url = isProduction() ? appConfig.weeklyReportApiUrlPROD : appConfig.weeklyReportApiUrlDEV;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEEKLY_REPORT_TIMEOUT_MS);

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

    const summary = typeof data?.summary === 'string' ? data.summary.trim() : null;
    if (!summary) return { ok: false, error: 'Empty proxy summary' };

    return { ok: true, summary };
}
