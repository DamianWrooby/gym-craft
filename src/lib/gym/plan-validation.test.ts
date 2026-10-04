import { describe, expect, it } from 'vitest';
import type { Plan, WorkoutStep } from '@models/plan/plan.model';
import { exerciseMap } from '@/constants/workout.constants';
import { correctPlan, isValidPlan } from './plan-validation';

// Real catalogue entries, so the tests follow the exercise list instead of hard-coding names.
const [category, exercises] = [...exerciseMap.entries()][0];
const [firstExercise, secondExercise] = [...exercises];

const INTERVAL = 3;
const REPEAT = 6;
const PASSIVE = [2, 4, 5]; // cooldown, recovery, rest

function step(stepTypeId: number, extra: Partial<WorkoutStep> = {}): WorkoutStep {
    return { stepType: { stepTypeId }, category: null, exerciseName: null, ...extra } as WorkoutStep;
}

function planOf(...steps: WorkoutStep[]): Plan {
    return { workouts: [{ workoutSegments: [{ workoutSteps: steps }] }] } as unknown as Plan;
}

describe('isValidPlan', () => {
    it('accepts an active step with a known category and exercise', () => {
        expect(isValidPlan(planOf(step(INTERVAL, { category, exerciseName: firstExercise })))).toBe(true);
    });

    it('rejects an active step with a missing or unknown exercise', () => {
        expect(isValidPlan(planOf(step(INTERVAL, { category })))).toBe(false);
        expect(isValidPlan(planOf(step(INTERVAL, { category, exerciseName: 'NOT_AN_EXERCISE' })))).toBe(false);
        expect(isValidPlan(planOf(step(INTERVAL, { category: 'NOT_A_CATEGORY', exerciseName: firstExercise })))).toBe(
            false,
        );
    });

    it.each(PASSIVE)('accepts passive step type %i without an exercise', (id) => {
        expect(isValidPlan(planOf(step(id)))).toBe(true);
    });

    it('validates every step inside a repeat block', () => {
        const good = step(INTERVAL, { category, exerciseName: firstExercise });
        const bad = step(INTERVAL, { category });
        expect(isValidPlan(planOf(step(REPEAT, { workoutSteps: [good, step(5)] })))).toBe(true);
        expect(isValidPlan(planOf(step(REPEAT, { workoutSteps: [good, bad] })))).toBe(false);
        expect(isValidPlan(planOf(step(REPEAT)))).toBe(false);
    });

    it('rejects a step without a numeric step type', () => {
        expect(isValidPlan(planOf({ stepType: {} } as WorkoutStep))).toBe(false);
    });
});

describe('correctPlan', () => {
    it('clears category and exercise on passive steps', () => {
        const rest = step(5, { category, exerciseName: firstExercise });
        correctPlan(planOf(rest));
        expect(rest).toMatchObject({ category: null, exerciseName: null });
    });

    it('replaces an unknown exercise with the first exercise of a known category', () => {
        const active = step(INTERVAL, { category, exerciseName: 'NOT_AN_EXERCISE' });
        correctPlan(planOf(active));
        expect(active.exerciseName).toBe(firstExercise);
    });

    it('keeps a valid exercise unchanged', () => {
        const active = step(INTERVAL, { category, exerciseName: secondExercise ?? firstExercise });
        correctPlan(planOf(active));
        expect(active.exerciseName).toBe(secondExercise ?? firstExercise);
    });

    it('leaves an unknown category alone, so validation still rejects it', () => {
        const plan = planOf(step(INTERVAL, { category: 'NOT_A_CATEGORY', exerciseName: 'X' }));
        expect(isValidPlan(correctPlan(plan))).toBe(false);
    });

    it('repairs steps inside a repeat block', () => {
        const inner = step(INTERVAL, { category, exerciseName: 'NOT_AN_EXERCISE' });
        const plan = correctPlan(planOf(step(REPEAT, { workoutSteps: [inner, step(5)] })));
        expect(inner.exerciseName).toBe(firstExercise);
        expect(isValidPlan(plan)).toBe(true);
    });
});
