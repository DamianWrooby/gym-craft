import { to } from 'await-to-js';
import { appConfig } from '@/constants/app.constants';
import { isProduction } from '$lib/utils/environment';
import { resolveSyncWindow, type SyncMode, type SyncStateSnapshot } from '$lib/garmin/sync-window';
import { isInvalidTokenMessage } from '$lib/garmin/invalid-token';

export type RunProxySyncErrorCode =
    | 'GARMIN_EMAIL_NOT_CONFIGURED'
    | 'INVALID_TOKEN'
    | 'STALE_STATE'
    | 'PROXY_ERROR'
    | 'PERSIST_ERROR';

export interface SyncSummary {
    mode: SyncMode;
    activitiesUpserted: number;
    lastSyncedAt: string;
}

export type RunProxySyncResult =
    | { ok: true; summary: SyncSummary }
    | { ok: false; code: RunProxySyncErrorCode; message: string };

export interface RunProxySyncArgs {
    userId: string;
    garminEmail: string | null;
    syncState: SyncStateSnapshot | null;
    password?: string;
}

type PostJsonResult = { ok: boolean; status: number; payload: Record<string, unknown> } | { error: string };

async function postJson(url: string, body: unknown): Promise<PostJsonResult> {
    const [fetchError, response] = await to(
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    );
    if (fetchError || !response) {
        return { error: fetchError?.message ?? 'Request failed' };
    }

    const [parseError, payload] = await to(response.json());
    if (parseError) {
        return { error: 'Invalid response' };
    }

    return { ok: response.ok, status: response.status, payload: payload as Record<string, unknown> };
}

/**
 * Two-step Garmin sync used by both the running hub and the analytics page:
 *   1. Browser → Express proxy (`/api/garmin-activities`) — the slow Garmin auth + fetch,
 *      which would otherwise blow past Netlify's 30s function timeout.
 *   2. Browser → SvelteKit (`/api/user/{id}/garmin/sync`) — fast map + upsert + state update.
 *
 * Returns a normalized result so each page can render its own toasts / inline errors.
 * On `INVALID_TOKEN` the caller should prompt for the Garmin password and call again with it.
 * On `STALE_STATE` the caller should reload fresh sync state and retry once.
 */
export async function runProxySync(args: RunProxySyncArgs): Promise<RunProxySyncResult> {
    const { userId, garminEmail, syncState, password } = args;

    if (!garminEmail) {
        return { ok: false, code: 'GARMIN_EMAIL_NOT_CONFIGURED', message: 'Garmin email not configured' };
    }

    const { mode, startDate, endDate } = resolveSyncWindow(syncState);
    const proxyUrl = isProduction() ? appConfig.garminActivitiesApiUrlPROD : appConfig.garminActivitiesApiUrlDEV;

    // Temporary diagnostics for the prod 429 investigation: timestamped so repeated calls
    // (e.g. an analytics-page mount loop) are visible in devtools.
    const t0 = Date.now();
    console.info('[garmin-sync] start', { mode, startDate, endDate, hasPassword: !!password });

    const proxy = await postJson(proxyUrl, {
        username: garminEmail,
        startDate,
        endDate,
        ...(password ? { password } : {}),
    });
    if ('error' in proxy) {
        console.warn('[garmin-sync] proxy unreachable', { error: proxy.error, ms: Date.now() - t0 });
        return { ok: false, code: 'PROXY_ERROR', message: proxy.error };
    }
    if (!proxy.ok) {
        const message = typeof proxy.payload.message === 'string' ? proxy.payload.message : undefined;
        console.warn('[garmin-sync] proxy error', {
            status: proxy.status,
            code: proxy.payload.code,
            message,
            ms: Date.now() - t0,
        });
        if (proxy.payload.code === 'INVALID_TOKEN' || isInvalidTokenMessage(message)) {
            return { ok: false, code: 'INVALID_TOKEN', message: message ?? 'Invalid Garmin token' };
        }
        return { ok: false, code: 'PROXY_ERROR', message: message ?? 'Garmin service error' };
    }

    const activities = Array.isArray(proxy.payload.data) ? proxy.payload.data : [];
    console.info('[garmin-sync] proxy ok', { count: activities.length, ms: Date.now() - t0 });

    const persist = await postJson(`/api/user/${userId}/garmin/sync`, { activities, mode });
    if ('error' in persist) {
        return { ok: false, code: 'PERSIST_ERROR', message: persist.error };
    }
    if (!persist.ok) {
        const message =
            typeof persist.payload.message === 'string' ? persist.payload.message : 'Failed to save activities';
        const code = persist.payload.code === 'STALE_STATE' ? 'STALE_STATE' : 'PERSIST_ERROR';
        return { ok: false, code, message };
    }

    return { ok: true, summary: persist.payload.data as SyncSummary };
}
