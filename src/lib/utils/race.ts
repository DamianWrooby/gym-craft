// Race distances and times, shared by the planner and the goal form. Client-importable.
import { m } from '$lib/paraglide/messages.js';

/** The race distances the planner accepts: 1500 m to the marathon. */
export const RACE_MIN_M = 1500;
export const RACE_MAX_M = 42195;

/** Standard race distances by metres, in the athlete's words and locale. */
const NAMED_RACE_DISTANCES: Record<number, () => string> = {
    1500: () => '1500 m',
    5000: () => '5 km',
    10000: () => '10 km',
    21097: m.race_half_marathon,
    42195: m.race_marathon,
};

export function distanceName(metres: number): string {
    return NAMED_RACE_DISTANCES[metres]?.() ?? `${(metres / 1000).toFixed(1)} km`;
}

/** Seconds as `h:mm:ss`, or `m:ss` under an hour. */
export function formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
