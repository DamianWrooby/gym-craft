import { toIsoDate } from '$lib/utils/iso-week';

export const BACKFILL_DAYS = 90;
export const INCREMENTAL_WINDOW_DAYS = 7;

export type SyncMode = 'backfill' | 'incremental';

export interface SyncStateSnapshot {
    backfillComplete: boolean;
    lastSyncedAt: string | null;
}

export interface SyncWindow {
    mode: SyncMode;
    startDate: string;
    endDate: string;
}

/**
 * Start date for an incremental sync: one day before the last sync (to catch late-arriving
 * edits), or a 7-day fallback window when the user has never synced.
 *
 * Pure date math shared by the server-side sync engine (`sync-activities.ts`) and the
 * client-side proxy flow (`run-proxy-sync.ts`).
 */
export function pickIncrementalStart(lastSyncedAt: Date | null, endDate: Date): Date {
    if (!lastSyncedAt) {
        const fallback = new Date(endDate);
        fallback.setUTCDate(fallback.getUTCDate() - INCREMENTAL_WINDOW_DAYS);
        return fallback;
    }

    const start = new Date(lastSyncedAt);
    start.setUTCDate(start.getUTCDate() - 1);
    return start;
}

/**
 * Resolve the date window + mode the browser should request from the proxy, based on the
 * sync state loaded into the page. Mirrors the backfill/incremental decision in
 * `syncUserActivities`. The server re-derives the authoritative mode on persist.
 */
export function resolveSyncWindow(syncState: SyncStateSnapshot | null, now: Date = new Date()): SyncWindow {
    const endDate = now;

    if (!syncState || !syncState.backfillComplete) {
        const start = new Date(endDate);
        start.setUTCDate(start.getUTCDate() - BACKFILL_DAYS);
        return { mode: 'backfill', startDate: toIsoDate(start), endDate: toIsoDate(endDate) };
    }

    const lastSyncedAt = syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt) : null;
    const start = pickIncrementalStart(lastSyncedAt, endDate);
    return { mode: 'incremental', startDate: toIsoDate(start), endDate: toIsoDate(endDate) };
}
