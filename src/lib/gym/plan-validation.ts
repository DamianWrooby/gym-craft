import type { GeneratedWorkout, Plan, WorkoutSegment, WorkoutStep } from '@models/plan/plan.model';
import { exerciseMap, workoutCategoriesSet } from '@/constants/workout.constants';

// Repairs and validates an AI-generated plan before it is saved. Moved out of the
// create-plan page so the background plan job (plan-job.ts) can use it.

export function correctPlan(plan: Plan): Plan {
    const isPassiveStep = (step: WorkoutStep): boolean =>
        step.stepType.stepTypeId === 5 || step.stepType.stepTypeId === 4 || step.stepType.stepTypeId === 2;

    const categoryCorrect = (step: WorkoutStep): boolean => {
        if (!step.category) return false;
        return workoutCategoriesSet.has(step.category);
    };

    const exerciseNameCorrect = (step: WorkoutStep): boolean => {
        if (!step.exerciseName || !step.category) return false;
        const exercises = exerciseMap.get(step.category);
        return !!exercises && exercises.has(step.exerciseName);
    };

    // Passive steps (cooldown, rest, recovery) carry no exercise; an active step with a known
    // category but an unknown exercise gets that category's first exercise. Repeat blocks are
    // repaired recursively, since validation checks their nested steps too.
    const repair = (step: WorkoutStep): void => {
        if (isPassiveStep(step) && (step.category || step.exerciseName)) {
            step.category = null;
            step.exerciseName = null;
        }
        if (!isPassiveStep(step) && categoryCorrect(step) && !exerciseNameCorrect(step)) {
            step.exerciseName = exerciseMap.get(step.category!)?.values().next().value || null;
        }
        step.workoutSteps?.forEach(repair);
    };

    plan.workouts.forEach((workout: GeneratedWorkout) => {
        workout.workoutSegments.forEach((segment: WorkoutSegment) => segment.workoutSteps.forEach(repair));
    });
    return plan;
}

export function isValidPlan(plan: Plan): boolean {
    return plan.workouts.every((workout: GeneratedWorkout) => {
        return workout.workoutSegments.every((segment: WorkoutSegment) => {
            return segment.workoutSteps.every((step: WorkoutStep) => isValidWorkoutStep(step));
        });
    });
}

function isValidWorkoutStep(step: WorkoutStep): boolean {
    if (!step.stepType || typeof step.stepType.stepTypeId !== 'number') return false;

    // for cooldown, rest and recovery steps omit category and exercise validation
    if (step.stepType.stepTypeId === 5 || step.stepType.stepTypeId === 4 || step.stepType.stepTypeId === 2) {
        return true;
        // for repeat step validate each nested step
    } else if (step.stepType.stepTypeId === 6) {
        return (
            Array.isArray(step.workoutSteps) &&
            step.workoutSteps?.every((repeatStep: WorkoutStep) => isValidWorkoutStep(repeatStep))
        );
    } else {
        if (!step.category || !step.exerciseName) {
            // console.log('Invalid step:', step);
            return false;
        }
        return !!exerciseMap.get(step.category)?.has(step.exerciseName);
    }
}
