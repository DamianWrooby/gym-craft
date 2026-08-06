import { to } from 'await-to-js';
import { appConfig } from '@/constants/app.constants';
import { isProduction } from '$lib/utils/environment';
import { resolveSyncWindow, type SyncMode, type SyncStateSnapshot } from '$lib/garmin/sync-window';
import { isInvalidTokenMessage } from '$lib/garmin/invalid-token';
import { splitDateRange } from '$lib/garmin/date-chunks';

export type RunProxySyncErrorCode =
    | 'GARMIN_EMAIL_NOT_CONFIGURED'
    | 'INVALID_TOKEN'
    | 'STALE_STATE'
    | 'GARMIN_TIMEOUT'
    | 'PROXY_ERROR'
    | 'PERSIST_ERROR';

export interface SyncSummary {
    mode: SyncMode;
    activitiesUpserted: number;
    lastSyncedAt: string;
}

export type RunProxySyncResult =
    { ok: true; summary: SyncSummary } | { ok: false; code: RunProxySyncErrorCode; message: string };

export interface RunProxySyncArgs {
    userId: string;
    garminEmail: string | null;
    syncState: SyncStateSnapshot | null;
    /** Opaque Garmin session token (Bearer). When absent, the caller must prompt for a login. */
    sessionToken: string | null;
    /** Tier-based backfill window (TIER_LIMITS[tier].garminBackfillDays). */
    backfillDays: number;
    /**
     * Called after each proxy window completes. A backfill is several sequential calls of up to
     * 150s each, so without this the UI has nothing to show for minutes at a time. Fires once with
     * `total: 1` for an incremental sync, so callers need no special case.
     */
    onProgress?: (completed: number, total: number) => void;
}

const GARMIN_WAKE_BUDGET_MS = 120_000;
const GARMIN_WAKE_INTERVAL_MS = 3_000;

/**
 * Must stay above the proxy's own 120s ceiling: aborting earlier would cancel requests that were
 * about to succeed and turn a slow Garmin into a client error the proxy could have explained.
 */
const PROXY_REQUEST_TIMEOUT_MS = 150_000;

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

type PostJsonResult =
    { ok: boolean; status: number; payload: Record<string, unknown> } | { error: string; aborted?: boolean };

interface PostJsonOptions {
    headers?: Record<string, string>;
    timeoutMs?: number;
}

async function postJson(url: string, body: unknown, options: PostJsonOptions = {}): Promise<PostJsonResult> {
    const { headers = {}, timeoutMs } = options;

    const controller = timeoutMs ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const [fetchError, response] = await to(
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(body),
            ...(controller ? { signal: controller.signal } : {}),
        }),
    );
    if (timer) clearTimeout(timer);

    if (fetchError || !response) {
        const aborted = fetchError?.name === 'AbortError';
        return { error: fetchError?.message ?? 'Request failed', aborted };
    }

    // Read as text first: a Render edge error (throttle, cold start) answers with HTML, and a
    // bare .json() would turn that into an opaque parse failure instead of a reportable status.
    const [readError, raw] = await to(response.text());
    if (readError) {
        return { error: 'Could not read the response' };
    }

    let payload: Record<string, unknown> = {};
    if (raw && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null) payload = parsed as Record<string, unknown>;
        } catch {
            // Non-JSON body: keep the status, let the caller report it generically.
            if (response.ok) return { error: 'Invalid response' };
        }
    }

    return { ok: response.ok, status: response.status, payload };
}

/**
 * Maps a proxy failure onto a caller-facing code. The proxy tags its own errors — `INVALID_TOKEN`
 * for a credentials problem, `GARMIN_SERVICE_ERROR` for everything transient — so the `code` is
 * what we branch on; the message text is only a fallback for older service builds.
 */
function classifyProxyFailure(
    status: number,
    payload: Record<string, unknown>,
): { code: RunProxySyncErrorCode; message: string } {
    const message = typeof payload.message === 'string' ? payload.message : undefined;

    if (status === 401 || payload.code === 'INVALID_TOKEN' || isInvalidTokenMessage(message)) {
        return { code: 'INVALID_TOKEN', message: message ?? 'Invalid Garmin session' };
    }
    // 504 is the proxy giving up on Garmin after 120s — transient, and worth retrying.
    if (status === 504) {
        return { code: 'GARMIN_TIMEOUT', message: message ?? 'Garmin service timed out' };
    }
    return { code: 'PROXY_ERROR', message: message ?? 'Garmin service error' };
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
 * On `GARMIN_TIMEOUT` Garmin itself was too slow — offer a plain retry.
 */
export async function runProxySync(args: RunProxySyncArgs): Promise<RunProxySyncResult> {
    const { userId, garminEmail, syncState, sessionToken, backfillDays } = args;

    if (!garminEmail) {
        return { ok: false, code: 'GARMIN_EMAIL_NOT_CONFIGURED', message: 'Garmin email not configured' };
    }
    // No session yet (never signed in, or it was cleared) — the caller must prompt for a Garmin login.
    if (!sessionToken) {
        return { ok: false, code: 'INVALID_TOKEN', message: 'Garmin session required' };
    }

    const { mode, startDate, endDate } = resolveSyncWindow(syncState, backfillDays);
    const proxyUrl = isProduction() ? appConfig.garminActivitiesApiUrlPROD : appConfig.garminActivitiesApiUrlDEV;

    // Wake the spun-down microservice from the browser before the proxy tries to use it. In dev
    // the Flask service runs locally and is always up, so this is prod-only.
    if (isProduction()) {
        await wakeGarminService();
    }

    // A backfill spans up to 120 days, which is exactly the window Garmin is slowest on, so it
    // goes out as month-sized requests. Incremental syncs are a week and stay a single call.
    const windows = mode === 'backfill' ? splitDateRange(startDate, endDate) : [{ startDate, endDate }];

    const activities: unknown[] = [];
    for (const [index, range] of windows.entries()) {
        // The Bearer token is the identity; the proxy forwards it to the microservice. No credentials.
        const proxy = await postJson(
            proxyUrl,
            { startDate: range.startDate, endDate: range.endDate },
            { headers: { Authorization: `Bearer ${sessionToken}` }, timeoutMs: PROXY_REQUEST_TIMEOUT_MS },
        );
        if ('error' in proxy) {
            const code = proxy.aborted ? 'GARMIN_TIMEOUT' : 'PROXY_ERROR';
            return { ok: false, code, message: proxy.aborted ? 'Garmin service timed out' : proxy.error };
        }
        if (!proxy.ok) {
            return { ok: false, ...classifyProxyFailure(proxy.status, proxy.payload) };
        }

        // Partial results are never persisted: a `backfill` write marks the backfill complete, so
        // saving half a window would leave a permanent hole no later sync goes back to fill. A 200
        // without a `data` array is that same hole wearing a success status — an empty body, or a
        // shape we do not recognise — so it fails the whole sync rather than counting as no rides.
        if (!Array.isArray(proxy.payload.data)) {
            return { ok: false, code: 'PROXY_ERROR', message: 'Garmin returned an unreadable window' };
        }
        activities.push(...proxy.payload.data);
        args.onProgress?.(index + 1, windows.length);
    }

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
