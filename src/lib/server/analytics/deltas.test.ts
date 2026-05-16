import { describe, expect, it } from 'vitest';
import { computeDeltas } from './deltas';
import { computeEfficiency } from './efficiency';
import { computeIntensity } from './intensity';
import { computeVolume } from './volume';
import { makeActivity } from './test-fixtures';

function buildCurrent(activities: ReturnType<typeof makeActivity>[]) {
    return {
        volume: computeVolume(activities, '2026-05-11', '2026-05-17'),
        intensity: computeIntensity(activities),
        efficiency: computeEfficiency(activities),
    };
}

describe('computeDeltas', () => {
    it('returns null when there is no previous week', () => {
        const current = buildCurrent([makeActivity()]);
        expect(computeDeltas(current, null)).toBeNull();
    });

    it('returns null when previous week is an empty array', () => {
        const current = buildCurrent([makeActivity()]);
        expect(computeDeltas(current, [])).toBeNull();
    });

    it('computes signed distance and duration deltas vs previous week', () => {
        const current = buildCurrent([
            makeActivity({ activityId: 1, distance: 10000, duration: 3000 }),
        ]);
        const previous = [
            makeActivity({ activityId: 99, distance: 8000, duration: 2400 }),
        ];

        const deltas = computeDeltas(current, previous);

        expect(deltas?.distanceM).toBe(2000);
        expect(deltas?.durationSec).toBe(600);
    });

    it('produces negative deltas when current week is lower volume', () => {
        const current = buildCurrent([makeActivity({ distance: 3000, duration: 1200 })]);
        const previous = [makeActivity({ activityId: 99, distance: 10000, duration: 3000 })];

        const deltas = computeDeltas(current, previous);

        expect(deltas?.distanceM).toBe(-7000);
        expect(deltas?.durationSec).toBe(-1800);
    });

    it('computes vigorousMinutes delta', () => {
        const current = buildCurrent([
            makeActivity({ vigorousIntensityMinutes: 30 }),
        ]);
        const previous = [makeActivity({ activityId: 99, vigorousIntensityMinutes: 10 })];

        const deltas = computeDeltas(current, previous);

        expect(deltas?.vigorousMinutes).toBe(20);
    });

    it('returns avgHRDelta when both weeks have HR data', () => {
        const current = buildCurrent([
            makeActivity({ averageHR: 150, distance: 5000, duration: 1800, movingDuration: 1800 }),
        ]);
        const previous = [
            makeActivity({ activityId: 99, averageHR: 145, distance: 5000, duration: 1800, movingDuration: 1800 }),
        ];

        const deltas = computeDeltas(current, previous);

        expect(deltas?.avgHRDelta).toBe(5);
    });

    it('returns null avgHRDelta when either side has no HR data', () => {
        const current = buildCurrent([makeActivity({ averageHR: undefined })]);
        const previous = [makeActivity({ activityId: 99, averageHR: 145 })];

        const deltas = computeDeltas(current, previous);

        expect(deltas?.avgHRDelta).toBeNull();
    });
});
