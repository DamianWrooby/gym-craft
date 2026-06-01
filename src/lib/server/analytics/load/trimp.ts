const EDWARDS_ZONE_WEIGHTS = [1, 2, 3, 4, 5] as const;

const BANISTER_COEFFS = {
    male: { a: 0.64, b: 1.92 },
    female: { a: 0.86, b: 1.67 },
} as const;

export type TrimpSex = 'male' | 'female';

export interface TrimpZoneSeconds {
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
}

export interface TrimpInputs {
    durationSec: number;
    hrZoneSeconds?: TrimpZoneSeconds | null;
    averageHr?: number | null;
    restingHr?: number | null;
    maxHr?: number | null;
    sex?: TrimpSex;
}

export function computeTrimp(inputs: TrimpInputs): number {
    if (inputs.hrZoneSeconds) {
        return edwardsTrimp(inputs.hrZoneSeconds);
    }
    if (
        inputs.averageHr != null &&
        inputs.restingHr != null &&
        inputs.maxHr != null &&
        inputs.maxHr > inputs.restingHr
    ) {
        return banisterTrimp(
            inputs.durationSec,
            inputs.averageHr,
            inputs.restingHr,
            inputs.maxHr,
            inputs.sex ?? 'male',
        );
    }
    return durationFallbackTrimp(inputs.durationSec);
}

export function edwardsTrimp(zones: TrimpZoneSeconds): number {
    const seconds: number[] = [zones.zone1, zones.zone2, zones.zone3, zones.zone4, zones.zone5];
    return seconds.reduce((acc, s, i) => acc + (s / 60) * EDWARDS_ZONE_WEIGHTS[i], 0);
}

export function banisterTrimp(
    durationSec: number,
    averageHr: number,
    restingHr: number,
    maxHr: number,
    sex: TrimpSex = 'male',
): number {
    const ratio = clamp((averageHr - restingHr) / (maxHr - restingHr), 0, 1);
    const { a, b } = BANISTER_COEFFS[sex];
    return (durationSec / 60) * ratio * a * Math.exp(b * ratio);
}

function durationFallbackTrimp(durationSec: number): number {
    return (durationSec / 60) * 2;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
