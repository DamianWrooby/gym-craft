import { describe, expect, it } from 'vitest';
import { computeWeeklyMetrics } from './index';
import { makeActivity } from './test-fixtures';

describe('computeWeeklyMetrics', () => {
    it('flags noActivities when the week is empty and still returns a 7-day frame', () => {
        const bundle = computeWeeklyMetrics({
            periodStart: '2026-05-11',
            periodEnd: '2026-05-17',
            activities: [],
            hasHrZoneBounds: true,
        });

        expect(bundle.flags.noActivities).toBe(true);
        expect(bundle.flags.noRunningActivities).toBe(true);
        expect(bundle.flags.missingHRZones).toBe(true);
        expect(bundle.flags.missingHrZoneBounds).toBe(false);
        expect(bundle.volume.byDay).toHaveLength(7);
        expect(bundle.deltas).toBeNull();
        expect(bundle.crossTraining?.totals.count).toBe(0);
    });

    it('reports noRunningActivities=true but noActivities=false when only cross-training is present', () => {
        const bundle = computeWeeklyMetrics({
            periodStart: '2026-05-11',
            periodEnd: '2026-05-17',
            activities: [],
            crossTrainingActivities: [
                makeActivity({ activityId: 10, activityType: { typeKey: 'cycling' }, distance: 25000, duration: 4500 }),
            ],
            hasHrZoneBounds: true,
        });

        expect(bundle.flags.noRunningActivities).toBe(true);
        expect(bundle.flags.noActivities).toBe(false);
        expect(bundle.crossTraining?.totals.count).toBe(1);
        expect(bundle.crossTraining?.byType.cycling).toBeDefined();
    });

    it('flags missingHrZoneBounds when the profile has no bounds set', () => {
        const bundle = computeWeeklyMetrics({
            periodStart: '2026-05-11',
            periodEnd: '2026-05-17',
            activities: [makeActivity()],
            hasHrZoneBounds: false,
        });

        expect(bundle.flags.missingHrZoneBounds).toBe(true);
    });

    it('flags missingHRZones when activities are present but none carry zone data', () => {
        const bundle = computeWeeklyMetrics({
            periodStart: '2026-05-11',
            periodEnd: '2026-05-17',
            activities: [makeActivity({ hrZones: undefined })],
            hasHrZoneBounds: true,
        });

        expect(bundle.flags.noActivities).toBe(false);
        expect(bundle.flags.missingHRZones).toBe(true);
    });

    it('assembles a complete bundle for a realistic multi-day week', () => {
        const activities = [
            makeActivity({
                activityId: 1,
                startTimeLocal: '2026-05-11 07:00:00',
                activityType: { typeKey: 'running' },
                distance: 8000,
                duration: 2400,
                movingDuration: 2400,
                averageHR: 145,
                hrZones: { zone1: 1200, zone2: 900, zone3: 300, zone4: 0, zone5: 0 },
                vigorousIntensityMinutes: 5,
            }),
            makeActivity({
                activityId: 2,
                startTimeLocal: '2026-05-14 18:30:00',
                activityType: { typeKey: 'running' },
                distance: 12000,
                duration: 3600,
                movingDuration: 3600,
                averageHR: 158,
                hrZones: { zone1: 600, zone2: 1500, zone3: 1200, zone4: 300, zone5: 0 },
                vigorousIntensityMinutes: 15,
            }),
            makeActivity({
                activityId: 3,
                startTimeLocal: '2026-05-16 09:00:00',
                activityType: { typeKey: 'cycling' },
                distance: 30000,
                duration: 4500,
                movingDuration: 4200,
                averageHR: 135,
                hrZones: { zone1: 3000, zone2: 1200, zone3: 300, zone4: 0, zone5: 0 },
            }),
        ];
        const previousWeek = [
            makeActivity({ activityId: 99, distance: 25000, duration: 7200, averageHR: 150, vigorousIntensityMinutes: 10 }),
        ];

        const bundle = computeWeeklyMetrics({
            periodStart: '2026-05-11',
            periodEnd: '2026-05-17',
            activities,
            previousWeekActivities: previousWeek,
            hasHrZoneBounds: true,
        });

        expect(bundle.period).toEqual({ start: '2026-05-11', end: '2026-05-17' });
        expect(bundle.flags.noActivities).toBe(false);
        expect(bundle.flags.missingHRZones).toBe(false);
        expect(bundle.volume.totalDistanceM).toBe(50000);
        expect(bundle.volume.byType.running.count).toBe(2);
        expect(bundle.volume.byType.cycling.count).toBe(1);
        expect(bundle.intensity.hrZoneSeconds).not.toBeNull();
        expect(bundle.efficiency.averagePaceSecPerKm).not.toBeNull();
        expect(bundle.deltas).not.toBeNull();
        expect(bundle.deltas?.distanceM).toBe(25000);
    });
});
