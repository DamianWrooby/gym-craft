import { describe, expect, it } from 'vitest';
import { computeEfficiency } from './efficiency';
import { makeActivity } from './test-fixtures';

describe('computeEfficiency', () => {
    it('returns null pace when distance is zero', () => {
        const activity = makeActivity({ distance: 0, duration: 1800 });
        const efficiency = computeEfficiency([activity]);
        expect(efficiency.perActivity[0].avgPaceSecPerKm).toBeNull();
    });

    it('returns null pace when duration is zero', () => {
        const activity = makeActivity({ distance: 5000, duration: 0, movingDuration: undefined });
        const efficiency = computeEfficiency([activity]);
        expect(efficiency.perActivity[0].avgPaceSecPerKm).toBeNull();
    });

    it('uses movingDuration over duration when available and positive', () => {
        const activity = makeActivity({
            distance: 5000,
            duration: 1800, // 6:00/km
            movingDuration: 1500, // 5:00/km
        });

        const efficiency = computeEfficiency([activity]);

        // 1500 / 5 = 300 sec/km
        expect(efficiency.perActivity[0].avgPaceSecPerKm).toBe(300);
    });

    it('falls back to total duration when movingDuration is missing', () => {
        const activity = makeActivity({ distance: 5000, duration: 1800, movingDuration: undefined });
        const efficiency = computeEfficiency([activity]);
        // 1800 / 5 = 360 sec/km
        expect(efficiency.perActivity[0].avgPaceSecPerKm).toBe(360);
    });

    it('passes through avgHR per activity, null when missing', () => {
        const activities = [
            makeActivity({ activityId: 1, averageHR: 145 }),
            makeActivity({ activityId: 2, averageHR: undefined }),
        ];

        const efficiency = computeEfficiency(activities);

        expect(efficiency.perActivity[0].avgHR).toBe(145);
        expect(efficiency.perActivity[1].avgHR).toBeNull();
    });

    it('returns null weekly averages when no valid data points exist', () => {
        const activity = makeActivity({ distance: 0, duration: 0, averageHR: undefined });
        const efficiency = computeEfficiency([activity]);
        expect(efficiency.averagePaceSecPerKm).toBeNull();
        expect(efficiency.averageHR).toBeNull();
    });

    it('computes weekly averages from valid data points only', () => {
        const activities = [
            makeActivity({ activityId: 1, distance: 5000, duration: 1500, movingDuration: 1500, averageHR: 140 }),
            makeActivity({ activityId: 2, distance: 10000, duration: 3000, movingDuration: 3000, averageHR: 150 }),
            makeActivity({ activityId: 3, distance: 0, duration: 0, averageHR: undefined }),
        ];

        const efficiency = computeEfficiency(activities);

        // Both valid paces are 300 sec/km, so avg = 300
        expect(efficiency.averagePaceSecPerKm).toBe(300);
        expect(efficiency.averageHR).toBe(145);
    });
});
