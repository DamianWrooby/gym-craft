import { isRunningTypeKey } from '$lib/utils/activity-type';
import type { AthleteProfile, LoadMethod } from '@prisma/client';

const EDWARDS_ZONE_WEIGHTS = [1, 2, 3, 4, 5] as const;

const BANISTER_COEFFS = {
    male: { a: 0.64, b: 1.92 },
    female: { a: 0.86, b: 1.67 },
} as const;

export type TrimpSex = 'male' | 'female';

export interface TrimpProfile {
    restingHR: number | null;
    maxHR: number | null;
    sex?: TrimpSex | null;
}

export function mapProfileSex(sex: AthleteProfile['sex']): TrimpSex {
    return sex === 'FEMALE' ? 'female' : 'male';
}

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
    /** Strength is costed at the flat duration rate: a lift's heart rate does not measure its cost. */
    modality?: TrimpModality;
}

export type TrimpModality = 'running' | 'strength' | 'other';

/** The `LoadMethod` values the load engine can produce. */
export type TrimpMethod = Extract<LoadMethod, 'EDWARDS' | 'BANISTER' | 'DURATION'>;

export interface TrimpScore {
    load: number;
    method: TrimpMethod;
}

export function computeTrimp(inputs: TrimpInputs): number {
    return scoreTrimp(inputs).load;
}

export function scoreTrimp(inputs: TrimpInputs): TrimpScore {
    if (inputs.modality === 'strength') {
        return { load: durationFallbackTrimp(inputs.durationSec), method: 'DURATION' };
    }
    if (inputs.hrZoneSeconds) {
        return { load: edwardsTrimp(inputs.hrZoneSeconds), method: 'EDWARDS' };
    }
    if (
        inputs.averageHr != null &&
        inputs.restingHr != null &&
        inputs.maxHr != null &&
        inputs.maxHr > inputs.restingHr
    ) {
        return {
            load: banisterTrimp(
                inputs.durationSec,
                inputs.averageHr,
                inputs.restingHr,
                inputs.maxHr,
                inputs.sex ?? 'male',
            ),
            method: 'BANISTER',
        };
    }
    return { load: durationFallbackTrimp(inputs.durationSec), method: 'DURATION' };
}

export function trimpModality(activityType: string | null | undefined): TrimpModality {
    if (isRunningTypeKey(activityType)) return 'running';
    if (activityType?.startsWith('strength')) return 'strength';
    return 'other';
}

export interface ZoneBound {
    lowerBpm: number;
    upperBpm: number;
}

export interface HrSample {
    timestampSec: number;
    heartRate: number | null;
}

/**
 * Bins HR samples into the athlete's own five zones. Each sample holds until the next one;
 * the last sample has no interval. Below zone 1 does not count (Edwards ignores it); above
 * zone 5 counts as zone 5. Returns null when no sample carries a heart rate.
 */
export function zoneSecondsFromSamples(samples: HrSample[], bounds: ZoneBound[]): TrimpZoneSeconds | null {
    const seconds = [0, 0, 0, 0, 0];
    let sawHr = false;
    for (let i = 0; i < samples.length - 1; i++) {
        const hr = samples[i].heartRate;
        const dt = samples[i + 1].timestampSec - samples[i].timestampSec;
        if (hr == null || dt <= 0) continue;
        sawHr = true;
        const zone = zoneIndex(hr, bounds);
        if (zone != null) seconds[zone] += dt;
    }
    if (!sawHr) return null;
    return { zone1: seconds[0], zone2: seconds[1], zone3: seconds[2], zone4: seconds[3], zone5: seconds[4] };
}

function zoneIndex(hr: number, bounds: ZoneBound[]): number | null {
    if (hr < bounds[0].lowerBpm) return null;
    for (let i = 0; i < bounds.length; i++) {
        if (hr <= bounds[i].upperBpm) return i;
    }
    return bounds.length - 1;
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
