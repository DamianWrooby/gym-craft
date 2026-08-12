import { describe, expect, it } from 'vitest';
import {
    classifyModality,
    isNonTrainingActivityType,
    isRunningActivity,
    partitionRunningActivities,
} from './activity-type';
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

describe('classifyModality', () => {
    it.each(['running', 'trail_running', 'virtual_run', 'ultra_run'])('buckets %s as running', (typeKey) => {
        expect(classifyModality(typeKey)).toBe('running');
    });

    it.each(['cycling', 'road_biking', 'mountain_biking', 'gravel_cycling', 'indoor_cycling', 'virtual_ride'])(
        'buckets %s as cycling',
        (typeKey) => {
            expect(classifyModality(typeKey)).toBe('cycling');
        },
    );

    it.each(['swimming', 'lap_swimming', 'open_water_swimming'])('buckets %s as swimming', (typeKey) => {
        expect(classifyModality(typeKey)).toBe('swimming');
    });

    it.each(['hiking', 'walking', 'strength_training', 'yoga', 'rowing', 'elliptical'])(
        'buckets %s as other',
        (typeKey) => {
            expect(classifyModality(typeKey)).toBe('other');
        },
    );

    it('does not let the swim allowlist capture swimrun', () => {
        expect(classifyModality('swimrun')).toBe('other');
    });

    it('does not credit motor-assisted rides as cycling', () => {
        expect(classifyModality('e_bike_ride')).toBe('other');
        expect(classifyModality('e_bike_fitness')).toBe('other');
    });

    it('sends composite activities to other, since their distance spans three disciplines', () => {
        expect(classifyModality('multi_sport')).toBe('other');
    });

    it('falls back to substring matching for unknown running keys only', () => {
        expect(classifyModality('some_new_running_variant')).toBe('running');
        expect(classifyModality('some_new_cycling_variant')).toBe('other');
    });

    it('buckets a missing type key as other', () => {
        expect(classifyModality(null)).toBe('other');
        expect(classifyModality(undefined)).toBe('other');
        expect(classifyModality('')).toBe('other');
    });
});

describe('isNonTrainingActivityType', () => {
    it('treats walking as non-training', () => {
        expect(isNonTrainingActivityType('walking')).toBe(true);
    });

    it.each(['hiking', 'running', 'cycling', 'strength_training', null, undefined])(
        'treats %s as training',
        (typeKey) => {
            expect(isNonTrainingActivityType(typeKey)).toBe(false);
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

    it('drops walking from both buckets', () => {
        const activities = [makeActivity('running', 1), makeActivity('walking', 2), makeActivity('cycling', 3)];

        const { running, crossTraining } = partitionRunningActivities(activities);

        expect(running.map((a) => a.activityId)).toEqual([1]);
        expect(crossTraining.map((a) => a.activityId)).toEqual([3]);
    });

    it('keeps hiking as cross-training', () => {
        const { crossTraining } = partitionRunningActivities([makeActivity('hiking', 1)]);
        expect(crossTraining.map((a) => a.activityId)).toEqual([1]);
    });

    it('returns empty arrays when given no activities', () => {
        const { running, crossTraining } = partitionRunningActivities([]);
        expect(running).toEqual([]);
        expect(crossTraining).toEqual([]);
    });
});
