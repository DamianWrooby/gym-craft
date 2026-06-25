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
    /** Opaque Garmin session token (Bearer). When absent, the caller must prompt for a login. */
    sessionToken: string | null;
}

const GARMIN_WAKE_BUDGET_MS = 120_000;
const GARMIN_WAKE_INTERVAL_MS = 3_000;

/**
 * Render spins the free Garmin microservice down after ~15 min idle, and its Cloudflare edge
 * answers requests from the proxy's datacenter IP with a 429 instead of waking it — but a request
 * from the browser (a residential IP) does trigger the wake. So we wake it here, from the client,
 * before asking the proxy to use it.
 *
 * A resolved fetch (even a 401) means the request reached gunicorn → the instance is up. A
 * rejected fetch means the edge 429'd it (no CORS header, so the browser blocks the response) →
 * still asleep, keep waiting. Best-effort: on timeout we proceed anyway and let the proxy surface
 * any error rather than blocking the sync indefinitely.
 */
async function wakeGarminService(): Promise<void> {
    const url = appConfig.garminServiceWakeUrlPROD;
    const deadline = Date.now() + GARMIN_WAKE_BUDGET_MS;
    let attempt = 0;
    while (Date.now() < deadline) {
        attempt += 1;
        const [err, res] = await to(fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' }));
        if (!err && res && res.status !== 429) {
            console.info('[garmin-wake] service awake', { attempt, status: res.status });
            return;
        }
        console.info('[garmin-wake] waiting for service to wake…', { attempt });
        await new Promise((resolve) => setTimeout(resolve, GARMIN_WAKE_INTERVAL_MS));
    }
    console.warn('[garmin-wake] budget exhausted; proceeding anyway');
}

type PostJsonResult = { ok: boolean; status: number; payload: Record<string, unknown> } | { error: string };

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<PostJsonResult> {
    const [fetchError, response] = await to(
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(body),
        }),
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
    const { userId, garminEmail, syncState, sessionToken } = args;

    if (!garminEmail) {
        return { ok: false, code: 'GARMIN_EMAIL_NOT_CONFIGURED', message: 'Garmin email not configured' };
    }
    // No session yet (never signed in, or it was cleared) — the caller must prompt for a Garmin login.
    if (!sessionToken) {
        return { ok: false, code: 'INVALID_TOKEN', message: 'Garmin session required' };
    }

    const { mode, startDate, endDate } = resolveSyncWindow(syncState);
    const proxyUrl = isProduction() ? appConfig.garminActivitiesApiUrlPROD : appConfig.garminActivitiesApiUrlDEV;

    // Wake the spun-down microservice from the browser before the proxy tries to use it. In dev
    // the Flask service runs locally and is always up, so this is prod-only.
    if (isProduction()) {
        await wakeGarminService();
    }

    // The Bearer token is the identity; the proxy forwards it to the microservice. No credentials.
    const proxy = await postJson(proxyUrl, { startDate, endDate }, { Authorization: `Bearer ${sessionToken}` });
    if ('error' in proxy) {
        return { ok: false, code: 'PROXY_ERROR', message: proxy.error };
    }
    if (!proxy.ok) {
        const message = typeof proxy.payload.message === 'string' ? proxy.payload.message : undefined;
        if (proxy.status === 401 || proxy.payload.code === 'INVALID_TOKEN' || isInvalidTokenMessage(message)) {
            return { ok: false, code: 'INVALID_TOKEN', message: message ?? 'Invalid Garmin session' };
        }
        return { ok: false, code: 'PROXY_ERROR', message: message ?? 'Garmin service error' };
    }

    const activities = Array.isArray(proxy.payload.data) ? proxy.payload.data : [];

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
