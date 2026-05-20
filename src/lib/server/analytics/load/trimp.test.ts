import { describe, it, expect } from 'vitest';
import { computeTrimp, edwardsTrimp, banisterTrimp } from './trimp';

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
