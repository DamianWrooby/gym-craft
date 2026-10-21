import { describe, expect, it } from 'vitest';
import { GARMIN_STEP_CEILING, toGarminWorkout } from './workout-adapter';
import type { RunBlock } from '$lib/planner/core/session';

const run = (steps: unknown[]) => ({
    kind: 'RUNNING' as const,
    body: {
        bodyVersion: 1,
        title: 'Intervals',
        keySession: null,
        reason: null,
        cutKey: null,
        steps: steps as RunBlock[],
    },
});

describe('toGarminWorkout', () => {
    it('sends a pace target as metres per second, slow end first', () => {
        const result = toGarminWorkout(
            run([{ label: 'z2', durationSec: 600, target: { type: 'PACE', minSecPerKm: 250, maxSecPerKm: 400 } }]),
        );
        if (!result.ok) throw new Error(result.message);
        const [step] = result.workout.workoutSegments[0].workoutSteps;
        expect(step).toMatchObject({
            type: 'ExecutableStepDTO',
            endCondition: { conditionTypeKey: 'time' },
            endConditionValue: 600,
            targetType: { workoutTargetTypeKey: 'pace.zone' },
            targetValueOne: 2.5,
            targetValueTwo: 4,
        });
        expect(result.workout.sportType.sportTypeKey).toBe('running');
    });

    it('keeps a repeat as one group and flattens a repeat nested inside it', () => {
        const result = toGarminWorkout(
            run([
                {
                    repeat: 3,
                    steps: [
                        { label: 'z4', distanceM: 400 },
                        { repeat: 2, steps: [{ label: 'z1', durationSec: 60 }] },
                    ],
                },
            ]),
        );
        if (!result.ok) throw new Error(result.message);
        const [group] = result.workout.workoutSegments[0].workoutSteps;
        expect(group).toMatchObject({ type: 'RepeatGroupDTO', numberOfIterations: 3 });
        expect(group.workoutSteps?.map((s) => [s.type, s.endConditionValue])).toEqual([
            ['ExecutableStepDTO', 400],
            ['ExecutableStepDTO', 60],
            ['ExecutableStepDTO', 60],
        ]);
    });

    it('refuses a workout over the step ceiling', () => {
        const steps = Array.from({ length: GARMIN_STEP_CEILING + 1 }, () => ({ label: 'z1', durationSec: 60 }));
        expect(toGarminWorkout(run(steps))).toMatchObject({ ok: false, code: 'TOO_MANY_STEPS' });
        expect(toGarminWorkout(run(steps.slice(1))).ok).toBe(true);
    });

    it('writes strength load into the step description, one repeat group per exercise', () => {
        const result = toGarminWorkout({
            kind: 'STRENGTH',
            body: {
                bodyVersion: 1,
                title: 'Lower',
                template: 'heavy-lower',
                heavy: true,
                durationMin: 45,
                exercises: [{ name: 'Back squat', sets: 4, reps: '6', load: 'RPE 7' }],
            },
        });
        if (!result.ok) throw new Error(result.message);
        expect(result.workout.sportType.sportTypeKey).toBe('strength_training');
        const [group] = result.workout.workoutSegments[0].workoutSteps;
        expect(group.numberOfIterations).toBe(4);
        expect(group.workoutSteps?.[0].description).toBe('Back squat: 6 reps @ RPE 7');
    });

    it('refuses other training', () => {
        const result = toGarminWorkout({
            kind: 'OTHER',
            body: { bodyVersion: 1, title: 'Ride', durationMin: 60, effort: 'easy' },
        });
        expect(result).toMatchObject({ ok: false, code: 'UNSUPPORTED_KIND' });
    });
});
