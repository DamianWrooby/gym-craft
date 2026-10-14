import { describe, it, expect } from 'vitest';
import { computeTrimp, edwardsTrimp, banisterTrimp, scoreTrimp, trimpModality, zoneSecondsFromSamples } from './trimp';

describe('edwardsTrimp', () => {
    it('returns 0 when all zones are 0', () => {
        expect(edwardsTrimp({ zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 })).toBe(0);
    });

    it('weights minutes by zone (1×z1 + 2×z2 + ... + 5×z5)', () => {
        const result = edwardsTrimp({ zone1: 600, zone2: 600, zone3: 600, zone4: 0, zone5: 0 });
        expect(result).toBeCloseTo(10 + 20 + 30, 5);
    });

    it('zone 5 weighted heaviest', () => {
        const z1Only = edwardsTrimp({ zone1: 1800, zone2: 0, zone3: 0, zone4: 0, zone5: 0 });
        const z5Only = edwardsTrimp({ zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 1800 });
        expect(z5Only).toBe(z1Only * 5);
    });
});

describe('banisterTrimp', () => {
    it('returns 0 when avg HR equals resting HR', () => {
        expect(banisterTrimp(3600, 50, 50, 200)).toBe(0);
    });

    it('produces a positive value for typical inputs', () => {
        const value = banisterTrimp(3600, 150, 50, 200);
        expect(value).toBeGreaterThan(0);
    });

    it('is higher for higher avg HR at same duration', () => {
        const easy = banisterTrimp(3600, 120, 50, 200);
        const hard = banisterTrimp(3600, 180, 50, 200);
        expect(hard).toBeGreaterThan(easy);
    });

    it('uses female coefficients when sex=female', () => {
        const male = banisterTrimp(3600, 150, 50, 200, 'male');
        const female = banisterTrimp(3600, 150, 50, 200, 'female');
        expect(female).not.toBe(male);
    });
});

describe('computeTrimp dispatch', () => {
    it('prefers Edwards (zones) when both zones and avg HR are available', () => {
        const zones = { zone1: 600, zone2: 600, zone3: 600, zone4: 0, zone5: 0 };
        const result = computeTrimp({
            durationSec: 1800,
            hrZoneSeconds: zones,
            averageHr: 150,
            restingHr: 50,
            maxHr: 200,
        });
        expect(result).toBeCloseTo(edwardsTrimp(zones), 5);
    });

    it('falls back to Banister when zones missing but avg HR available', () => {
        const result = computeTrimp({
            durationSec: 3600,
            hrZoneSeconds: null,
            averageHr: 150,
            restingHr: 50,
            maxHr: 200,
        });
        expect(result).toBeCloseTo(banisterTrimp(3600, 150, 50, 200), 5);
    });

    it('falls back to duration-only when no HR data', () => {
        const result = computeTrimp({ durationSec: 3600 });
        expect(result).toBe(120);
    });

    it('falls back to duration-only when maxHr <= restingHr (invalid profile)', () => {
        const result = computeTrimp({ durationSec: 3600, averageHr: 150, restingHr: 200, maxHr: 180 });
        expect(result).toBe(120);
    });
});

describe('modality', () => {
    it('costs strength at the flat duration rate even with HR data', () => {
        const score = scoreTrimp({
            durationSec: 3600,
            hrZoneSeconds: { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 3600 },
            averageHr: 170,
            restingHr: 50,
            maxHr: 190,
            modality: 'strength',
        });
        expect(score).toEqual({ load: 120, method: 'DURATION' });
    });

    it('scores running and other modalities from HR zones', () => {
        const zones = { zone1: 600, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
        expect(scoreTrimp({ durationSec: 600, hrZoneSeconds: zones, modality: 'running' })).toEqual({
            load: 10,
            method: 'EDWARDS',
        });
        expect(scoreTrimp({ durationSec: 600, hrZoneSeconds: zones, modality: 'other' }).method).toBe('EDWARDS');
    });

    it('reports Banister and duration methods', () => {
        expect(scoreTrimp({ durationSec: 600, averageHr: 150, restingHr: 50, maxHr: 190 }).method).toBe('BANISTER');
        expect(scoreTrimp({ durationSec: 600 })).toEqual({ load: 20, method: 'DURATION' });
    });

    it('maps activity types to modalities', () => {
        expect(trimpModality('trail_running')).toBe('running');
        expect(trimpModality('strength_training')).toBe('strength');
        expect(trimpModality('cycling')).toBe('other');
        expect(trimpModality(null)).toBe('other');
    });
});

describe('zoneSecondsFromSamples', () => {
    const bounds = [
        { lowerBpm: 100, upperBpm: 120 },
        { lowerBpm: 121, upperBpm: 140 },
        { lowerBpm: 141, upperBpm: 160 },
        { lowerBpm: 161, upperBpm: 175 },
        { lowerBpm: 176, upperBpm: 190 },
    ];

    it('bins each interval by the starting sample against the athlete zones', () => {
        const samples = [
            { timestampSec: 0, heartRate: 90 },
            { timestampSec: 10, heartRate: 130 },
            { timestampSec: 40, heartRate: 150 },
            { timestampSec: 100, heartRate: 200 },
            { timestampSec: 105, heartRate: null },
            { timestampSec: 200, heartRate: 110 },
        ];
        expect(zoneSecondsFromSamples(samples, bounds)).toEqual({
            zone1: 0,
            zone2: 30,
            zone3: 60,
            zone4: 0,
            zone5: 5,
        });
    });

    it('returns null when no sample has a heart rate', () => {
        expect(
            zoneSecondsFromSamples(
                [
                    { timestampSec: 0, heartRate: null },
                    { timestampSec: 10, heartRate: null },
                ],
                bounds,
            ),
        ).toBeNull();
    });
});
