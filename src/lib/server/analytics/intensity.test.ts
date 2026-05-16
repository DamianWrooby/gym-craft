import { describe, expect, it } from 'vitest';
import { computeIntensity } from './intensity';
import { makeActivity } from './test-fixtures';

describe('computeIntensity', () => {
    it('returns null zones when no activity carries hrZones', () => {
        const activities = [
            makeActivity({ activityId: 1, hrZones: undefined, moderateIntensityMinutes: 10, vigorousIntensityMinutes: 2 }),
            makeActivity({ activityId: 2, hrZones: undefined, moderateIntensityMinutes: 15, vigorousIntensityMinutes: 1 }),
        ];

        const intensity = computeIntensity(activities);

        expect(intensity.hrZoneSeconds).toBeNull();
        expect(intensity.hrZonePercents).toBeNull();
        expect(intensity.polarizationIndex).toBeNull();
        expect(intensity.moderateMinutes).toBe(25);
        expect(intensity.vigorousMinutes).toBe(3);
    });

    it('sums HR zone seconds across activities', () => {
        const activities = [
            makeActivity({
                activityId: 1,
                hrZones: { zone1: 600, zone2: 900, zone3: 300, zone4: 0, zone5: 0 },
            }),
            makeActivity({
                activityId: 2,
                hrZones: { zone1: 300, zone2: 300, zone3: 600, zone4: 100, zone5: 0 },
            }),
        ];

        const intensity = computeIntensity(activities);

        expect(intensity.hrZoneSeconds).toEqual({ zone1: 900, zone2: 1200, zone3: 900, zone4: 100, zone5: 0 });
    });

    it('computes percentages summing approximately to 100', () => {
        const activities = [
            makeActivity({ hrZones: { zone1: 1000, zone2: 1000, zone3: 1000, zone4: 1000, zone5: 1000 } }),
        ];

        const intensity = computeIntensity(activities);

        expect(intensity.hrZonePercents).toEqual({ zone1: 20, zone2: 20, zone3: 20, zone4: 20, zone5: 20 });
    });

    it('computes polarizationIndex as (Z1+Z2) / (Z3+Z4+Z5)', () => {
        const activities = [
            makeActivity({ hrZones: { zone1: 600, zone2: 600, zone3: 300, zone4: 0, zone5: 0 } }),
        ];

        const intensity = computeIntensity(activities);

        // (600 + 600) / (300 + 0 + 0) = 4
        expect(intensity.polarizationIndex).toBe(4);
    });

    it('returns null polarizationIndex when there is no high-intensity time', () => {
        const activities = [
            makeActivity({ hrZones: { zone1: 600, zone2: 600, zone3: 0, zone4: 0, zone5: 0 } }),
        ];

        const intensity = computeIntensity(activities);

        expect(intensity.polarizationIndex).toBeNull();
    });

    it('handles mixed activities — some with zones, some without', () => {
        const activities = [
            makeActivity({ activityId: 1, hrZones: { zone1: 600, zone2: 600, zone3: 0, zone4: 0, zone5: 0 } }),
            makeActivity({ activityId: 2, hrZones: undefined, moderateIntensityMinutes: 10 }),
        ];

        const intensity = computeIntensity(activities);

        // hasZoneData is true from activity 1, so seconds/percents are computed
        expect(intensity.hrZoneSeconds).toEqual({ zone1: 600, zone2: 600, zone3: 0, zone4: 0, zone5: 0 });
        expect(intensity.moderateMinutes).toBeGreaterThanOrEqual(10);
    });

    it('rounds zone percents to one decimal', () => {
        const activities = [
            makeActivity({ hrZones: { zone1: 333, zone2: 333, zone3: 334, zone4: 0, zone5: 0 } }),
        ];

        const intensity = computeIntensity(activities);

        expect(intensity.hrZonePercents?.zone1).toBeCloseTo(33.3, 1);
        expect(intensity.hrZonePercents?.zone3).toBeCloseTo(33.4, 1);
    });
});
