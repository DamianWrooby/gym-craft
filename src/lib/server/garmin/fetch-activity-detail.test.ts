import { describe, it, expect } from 'vitest';
import { normalizeDetailForTest } from './fetch-activity-detail';

describe('normalizeDetail', () => {
    it('maps cadence/power on samples and the new route + dynamics fields', () => {
        const detail = normalizeDetailForTest({
            activityId: 1,
            activityType: 'running',
            samples: [{ timestampSec: 0, heartRate: 120, speed: 3, elevationM: 100, cadence: 168, power: 240 }],
            route: [{ lat: 50.06, lng: 19.93 }],
            dynamics: { avgCadence: 168, avgPowerW: 238, maxPowerW: 402, minTemperatureC: 11, maxTemperatureC: 17 },
        });
        expect(detail.samples[0].cadence).toBe(168);
        expect(detail.samples[0].power).toBe(240);
        expect(detail.route).toEqual([{ lat: 50.06, lng: 19.93 }]);
        expect(detail.dynamics?.avgCadence).toBe(168);
    });

    it('defaults route to [] and dynamics to null when absent', () => {
        const detail = normalizeDetailForTest({ activityId: 1, activityType: 'running', samples: [] });
        expect(detail.route).toEqual([]);
        expect(detail.dynamics).toBeNull();
    });
});
