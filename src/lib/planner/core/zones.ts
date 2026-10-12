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

export function isValidZones(value: unknown): value is HrZoneBound[] {
    if (!Array.isArray(value) || value.length !== 5) return false;
    let previousUpper = 0;
    return value.every((z, i) => {
        const ok =
            z &&
            z.zone === i + 1 &&
            Number.isInteger(z.lowerBpm) &&
            Number.isInteger(z.upperBpm) &&
            z.lowerBpm > previousUpper &&
            z.upperBpm > z.lowerBpm &&
            z.upperBpm <= 250;
        previousUpper = z?.upperBpm;
        return ok;
    });
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
