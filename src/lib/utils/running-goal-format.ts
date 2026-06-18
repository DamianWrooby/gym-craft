/**
 * Conversion helpers between the runner-friendly form inputs (kilometers,
 * HH:MM:SS) and the storage units used by the API / DB (meters, seconds).
 */

/** Convert a distance in meters to kilometers for display in inputs. */
export function metersToKm(meters: number | null | undefined): number | null {
    if (meters === null || meters === undefined) return null;
    return meters / 1000;
}

/** Convert a distance in kilometers to whole meters for storage. */
export function kmToMeters(km: number | null | undefined): number | null {
    if (km === null || km === undefined || Number.isNaN(km)) return null;
    return Math.round(km * 1000);
}

export interface Hms {
    hours: number;
    minutes: number;
    seconds: number;
}

/** Split a total number of seconds into hours / minutes / seconds parts. */
export function secondsToHms(total: number | null | undefined): Hms {
    if (total === null || total === undefined || Number.isNaN(total) || total <= 0) {
        return { hours: 0, minutes: 0, seconds: 0 };
    }
    const t = Math.round(total);
    return {
        hours: Math.floor(t / 3600),
        minutes: Math.floor((t % 3600) / 60),
        seconds: t % 60,
    };
}

/** Combine hours / minutes / seconds into a total second count (null if all empty/zero). */
export function hmsToSeconds(hours: number | null, minutes: number | null, seconds: number | null): number | null {
    const h = Number(hours) || 0;
    const m = Number(minutes) || 0;
    const s = Number(seconds) || 0;
    const total = h * 3600 + m * 60 + s;
    return total > 0 ? total : null;
}

/** Format a total number of seconds as a human-readable H:MM:SS / M:SS string. */
export function formatGoalTime(total: number | null | undefined): string | null {
    if (total === null || total === undefined || Number.isNaN(total) || total <= 0) return null;
    const { hours, minutes, seconds } = secondsToHms(total);
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    if (hours > 0) return `${hours}:${mm}:${ss}`;
    return `${minutes}:${ss}`;
}
