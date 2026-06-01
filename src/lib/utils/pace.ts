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
        const secPerKm = 1000 / speedMps;
        const minutes = Math.floor(secPerKm / 60);
        const seconds = Math.floor(secPerKm % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
    }
    return `${(speedMps * 3.6).toFixed(1)} km/h`;
}
