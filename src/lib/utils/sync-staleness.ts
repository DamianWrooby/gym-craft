export const SYNC_STALE_AFTER_MS = 15 * 60 * 1000;

export function isSyncStale(lastSyncedAt: Date | string | null, now: Date = new Date()): boolean {
    if (!lastSyncedAt) return true;
    const last = lastSyncedAt instanceof Date ? lastSyncedAt : new Date(lastSyncedAt);
    return now.getTime() - last.getTime() > SYNC_STALE_AFTER_MS;
}
