import { describe, it, expect } from 'vitest';
import { computeAerobicDecoupling } from './decoupling';
import type { ActivitySample } from '$lib/server/garmin/fetch-activity-detail';

function s(timestampSec: number, heartRate: number, speed: number): ActivitySample {
    return { timestampSec, heartRate, speed, elevationM: null, cadence: null, power: null };
}

describe('computeAerobicDecoupling', () => {
    it('returns ~0 when speed and HR hold steady', () => {
        const samples = Array.from({ length: 20 }, (_, i) => s(i * 60, 150, 3));
        expect(computeAerobicDecoupling(samples)).toBeCloseTo(0, 1);
    });

    it('is positive when HR climbs at constant speed (efficiency drops)', () => {
        const samples = Array.from({ length: 20 }, (_, i) => s(i * 60, 140 + i, 3));
        const decoupling = computeAerobicDecoupling(samples);
        expect(decoupling).toBeGreaterThan(0);
    });

    it('returns null with too few usable samples', () => {
        expect(computeAerobicDecoupling([s(0, 150, 3)])).toBeNull();
    });
});
