import { describe, expect, it } from 'vitest';
import { computeCrossTrainingSummary } from './cross-training';
import { makeActivity } from './test-fixtures';

describe('computeCrossTrainingSummary', () => {
    it('returns zeroed totals and empty byType when given no activities', () => {
        const summary = computeCrossTrainingSummary([]);
        expect(summary.totals).toEqual({
            count: 0,
            durationSec: 0,
            distanceM: 0,
            calories: 0,
            vigorousMinutes: 0,
            moderateMinutes: 0,
        });
        expect(summary.byType).toEqual({});
    });

    it('aggregates per type and totals', () => {
        const activities = [
            makeActivity({
                activityId: 1,
                activityType: { typeKey: 'cycling' },
                duration: 3600,
                distance: 30000,
                calories: 600,
                vigorousIntensityMinutes: 10,
                moderateIntensityMinutes: 30,
            }),
            makeActivity({
                activityId: 2,
                activityType: { typeKey: 'cycling' },
                duration: 1800,
                distance: 12000,
                calories: 300,
                vigorousIntensityMinutes: 5,
                moderateIntensityMinutes: 15,
            }),
            makeActivity({
                activityId: 3,
                activityType: { typeKey: 'strength_training' },
                duration: 2700,
                distance: 0,
                calories: 250,
                vigorousIntensityMinutes: 0,
                moderateIntensityMinutes: 20,
            }),
        ];

        const summary = computeCrossTrainingSummary(activities);

        expect(summary.byType.cycling).toEqual({
            count: 2,
            durationSec: 5400,
            distanceM: 42000,
            calories: 900,
            vigorousMinutes: 15,
            moderateMinutes: 45,
        });
        expect(summary.byType.strength_training).toEqual({
            count: 1,
            durationSec: 2700,
            distanceM: 0,
            calories: 250,
            vigorousMinutes: 0,
            moderateMinutes: 20,
        });
        expect(summary.totals).toEqual({
            count: 3,
            durationSec: 8100,
            distanceM: 42000,
            calories: 1150,
            vigorousMinutes: 15,
            moderateMinutes: 65,
        });
    });

    it('falls back to "unknown" typeKey when missing', () => {
        const summary = computeCrossTrainingSummary([
            makeActivity({ activityType: undefined as unknown as { typeKey: string } }),
        ]);
        expect(summary.byType.unknown).toBeDefined();
        expect(summary.byType.unknown.count).toBe(1);
    });
});
