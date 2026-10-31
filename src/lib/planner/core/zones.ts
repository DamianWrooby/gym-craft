// HR zone proposal (ADR 0010): GymCraft proposes, the athlete confirms in the wizard.
import { judged } from '../schools/types';

export interface HrZoneBound {
    zone: number;
    lowerBpm: number;
    upperBpm: number;
}

export type ZoneSource = 'profile' | 'max-hr' | 'age';

/** Upper bounds of zones 1–5 as a fraction of max HR (Garmin's default split). */
export const ZONE_FRACTIONS = judged([0.6, 0.7, 0.8, 0.9, 1.0], 'Garmin default %-of-max-HR zones.');
/** Lower bound of zone 1 as a fraction of max HR. */
export const ZONE1_FLOOR = judged(0.5);
/** Tanaka et al. 2001: 208 − 0.7 × age. A population estimate, so the athlete must confirm it. */
export const maxHrFromAge = (age: number) => Math.round(208 - 0.7 * age);

export function zonesFromMaxHr(maxHR: number): HrZoneBound[] {
    let lower = Math.round(maxHR * ZONE1_FLOOR.value);
    return ZONE_FRACTIONS.value.map((f, i) => {
        const upper = Math.round(maxHR * f);
        const bound = { zone: i + 1, lowerBpm: lower, upperBpm: upper };
        lower = upper + 1;
        return bound;
    });
}

export const MAX_ZONE_BPM = 250;

/** The first rule a zone list breaks, so the wizard can name the zone; null when the list is valid. */
export type ZoneIssue =
    | { kind: 'count' }
    | { kind: 'missing'; zone: number }
    | { kind: 'range'; zone: number }
    | { kind: 'overlap'; zone: number; previousUpper: number }
    | { kind: 'max'; zone: number };

export function zonesIssue(value: unknown): ZoneIssue | null {
    if (!Array.isArray(value) || value.length !== 5) return { kind: 'count' };
    let previousUpper = 0;
    for (const [i, z] of value.entries()) {
        const zone = i + 1;
        if (!z || z.zone !== zone || !Number.isInteger(z.lowerBpm) || !Number.isInteger(z.upperBpm)) {
            return { kind: 'missing', zone };
        }
        if (z.upperBpm <= z.lowerBpm) return { kind: 'range', zone };
        if (z.lowerBpm <= previousUpper) return { kind: 'overlap', zone, previousUpper };
        if (z.upperBpm > MAX_ZONE_BPM) return { kind: 'max', zone };
        previousUpper = z.upperBpm;
    }
    return null;
}

export function isValidZones(value: unknown): value is HrZoneBound[] {
    return zonesIssue(value) === null;
}

export function proposeZones(input: {
    existing: unknown;
    maxHR: number | null;
    age: number | null;
}): { source: ZoneSource; zones: HrZoneBound[] } | null {
    if (isValidZones(input.existing)) return { source: 'profile', zones: input.existing };
    if (input.maxHR) return { source: 'max-hr', zones: zonesFromMaxHr(input.maxHR) };
    if (input.age) return { source: 'age', zones: zonesFromMaxHr(maxHrFromAge(input.age)) };
    return null;
}
