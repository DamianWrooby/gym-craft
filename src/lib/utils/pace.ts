export const PACE_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
    'running',
    'walking',
    'hiking',
    'treadmill_running',
    'trail_running',
]);

export function isPaceActivityType(typeKey: string): boolean {
    return PACE_ACTIVITY_TYPES.has(typeKey);
}

export function formatPaceOrSpeed(speedMps: number | null | undefined, typeKey: string): string {
    if (!speedMps || speedMps <= 0) return '—';
    if (PACE_ACTIVITY_TYPES.has(typeKey)) {
        return formatPaceSecPerKm(1000 / speedMps) ?? '—';
    }
    return `${(speedMps * 3.6).toFixed(1)} km/h`;
}

/** Convert a speed in meters/second to running pace in seconds per kilometer. */
export function paceSecPerKmFromSpeed(speedMps: number | null | undefined): number | null {
    if (!speedMps || speedMps <= 0) return null;
    return Math.round(1000 / speedMps);
}

/** Format a seconds-per-kilometer pace as "m:ss /km". Accepts integer or float input. */
export function formatPaceSecPerKm(secPerKm: number | null | undefined): string | null {
    if (secPerKm == null || secPerKm <= 0 || !isFinite(secPerKm)) return null;
    const minutes = Math.floor(secPerKm / 60);
    const seconds = Math.floor(secPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}
