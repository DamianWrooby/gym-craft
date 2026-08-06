import { toIsoDate } from '$lib/utils/iso-week';

/**
 * Longest window asked of the proxy in one call. The proxy gives up on the Python Garmin service
 * after 120s, and a single wide range is the slow case — a 120-day backfill regularly walks into
 * that ceiling, while month-sized windows return well inside it.
 */
export const MAX_CHUNK_DAYS = 31;

export interface DateChunk {
    startDate: string;
    endDate: string;
}

function parseIsoDate(value: string): Date {
    return new Date(`${value}T00:00:00Z`);
}

function daysBetween(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Splits an inclusive `YYYY-MM-DD` range into consecutive, non-overlapping windows of at most
 * `maxDays` days. Non-overlapping keeps the upsert cheap; a single chunk is returned when the
 * range already fits, so short incremental syncs behave exactly as before.
 */
export function splitDateRange(startDate: string, endDate: string, maxDays: number = MAX_CHUNK_DAYS): DateChunk[] {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || maxDays < 1) {
        return [{ startDate, endDate }];
    }
    if (daysBetween(start, end) < maxDays) {
        return [{ startDate, endDate }];
    }

    const chunks: DateChunk[] = [];
    let cursor = start;

    while (cursor <= end) {
        const chunkEnd = new Date(cursor);
        chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays - 1);
        const cappedEnd = chunkEnd > end ? end : chunkEnd;

        chunks.push({ startDate: toIsoDate(cursor), endDate: toIsoDate(cappedEnd) });

        const next = new Date(cappedEnd);
        next.setUTCDate(next.getUTCDate() + 1);
        cursor = next;
    }

    return chunks;
}
