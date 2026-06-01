import { describe, expect, it } from 'vitest';
import { computeVolume } from './volume';
import { makeActivity } from './test-fixtures';

describe('computeVolume', () => {
    it('returns zeroed totals and a 7-day byDay frame for an empty week', () => {
        const volume = computeVolume([], '2026-05-11', '2026-05-17');

        expect(volume.totalDistanceM).toBe(0);
        expect(volume.totalDurationSec).toBe(0);
        expect(volume.totalCalories).toBe(0);
        expect(volume.byDay).toHaveLength(7);
        expect(volume.byDay.map((d) => d.date)).toEqual([
            '2026-05-11',
            '2026-05-12',
            '2026-05-13',
            '2026-05-14',
            '2026-05-15',
            '2026-05-16',
            '2026-05-17',
        ]);
        expect(volume.byDay.every((d) => d.distanceM === 0 && d.durationSec === 0)).toBe(true);
        expect(volume.byType).toEqual({});
    });

    it('aggregates a single activity into totals + the correct day bucket', () => {
        const activity = makeActivity({
            startTimeLocal: '2026-05-13 18:00:00',
            distance: 7500,
            duration: 2700,
            calories: 500,
        });

        const volume = computeVolume([activity], '2026-05-11', '2026-05-17');

        expect(volume.totalDistanceM).toBe(7500);
        expect(volume.totalDurationSec).toBe(2700);
        expect(volume.totalCalories).toBe(500);
        const wed = volume.byDay.find((d) => d.date === '2026-05-13');
        expect(wed).toEqual({ date: '2026-05-13', distanceM: 7500, durationSec: 2700 });
        const tue = volume.byDay.find((d) => d.date === '2026-05-12');
        expect(tue).toEqual({ date: '2026-05-12', distanceM: 0, durationSec: 0 });
    });

    it('groups by activityType.typeKey and counts per type', () => {
        const activities = [
            makeActivity({ activityId: 1, activityType: { typeKey: 'running' }, distance: 5000, duration: 1800 }),
            makeActivity({ activityId: 2, activityType: { typeKey: 'running' }, distance: 8000, duration: 2700 }),
            makeActivity({ activityId: 3, activityType: { typeKey: 'cycling' }, distance: 30000, duration: 3600 }),
        ];

        const volume = computeVolume(activities, '2026-05-11', '2026-05-17');

        expect(volume.byType.running).toEqual({ distanceM: 13000, durationSec: 4500, count: 2 });
        expect(volume.byType.cycling).toEqual({ distanceM: 30000, durationSec: 3600, count: 1 });
    });

    it('treats activities outside the period as totals-only (not bucketed)', () => {
        const inside = makeActivity({ startTimeLocal: '2026-05-12 09:00:00', distance: 5000, duration: 1800 });
        const outside = makeActivity({
            activityId: 99,
            startTimeLocal: '2026-05-20 09:00:00',
            distance: 1000,
            duration: 300,
        });

        const volume = computeVolume([inside, outside], '2026-05-11', '2026-05-17');

        expect(volume.totalDistanceM).toBe(6000);
        const dayTotals = volume.byDay.reduce((sum, d) => sum + d.distanceM, 0);
        expect(dayTotals).toBe(5000);
    });

    it('handles activities with missing distance/duration/calories gracefully', () => {
        const partial = makeActivity({ distance: 0, duration: 0, calories: 0 });
        const volume = computeVolume([partial], '2026-05-11', '2026-05-17');

        expect(volume.totalDistanceM).toBe(0);
        expect(volume.totalDurationSec).toBe(0);
        expect(volume.totalCalories).toBe(0);
    });
});
