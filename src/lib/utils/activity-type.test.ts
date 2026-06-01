import { describe, expect, it } from 'vitest';
import { isRunningActivity, partitionRunningActivities } from './activity-type';
import type { GarminActivity } from '@/models/garmin/activity.model';

function makeActivity(typeKey: string, activityId = 1): GarminActivity {
    return {
        activityId,
        activityName: typeKey,
        activityType: { typeKey },
        startTimeLocal: '2026-05-11 09:00:00',
        startTimeGMT: '2026-05-11 07:00:00',
        beginTimestamp: 0,
        duration: 1800,
        distance: 5000,
        calories: 300,
    };
}

describe('isRunningActivity', () => {
    it.each([
        'running',
        'treadmill_running',
        'trail_running',
        'track_running',
        'indoor_running',
        'street_running',
        'virtual_run',
        'ultra_run',
        'obstacle_run',
    ])('classifies %s as running', (typeKey) => {
        expect(isRunningActivity(makeActivity(typeKey))).toBe(true);
    });

    it.each(['cycling', 'indoor_cycling', 'swimming', 'walking', 'hiking', 'strength_training', 'yoga', 'cardio'])(
        'classifies %s as non-running',
        (typeKey) => {
            expect(isRunningActivity(makeActivity(typeKey))).toBe(false);
        },
    );
});

describe('partitionRunningActivities', () => {
    it('splits a mixed list into running and crossTraining', () => {
        const activities = [
            makeActivity('running', 1),
            makeActivity('cycling', 2),
            makeActivity('treadmill_running', 3),
            makeActivity('strength_training', 4),
        ];

        const { running, crossTraining } = partitionRunningActivities(activities);

        expect(running.map((a) => a.activityId)).toEqual([1, 3]);
        expect(crossTraining.map((a) => a.activityId)).toEqual([2, 4]);
    });

    it('returns empty arrays when given no activities', () => {
        const { running, crossTraining } = partitionRunningActivities([]);
        expect(running).toEqual([]);
        expect(crossTraining).toEqual([]);
    });
});
