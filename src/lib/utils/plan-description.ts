import { sportTypes, stepTypes, targetTypes } from '@/garmin/mapping';
import type { Plan, GeneratedWorkout, WorkoutStep } from '@models/plan/plan.model';

export function generateFullPlanDescription(plan: Plan): string {
    let html = `<h1>${plan.name}</h1>`;
    if (plan.description) {
        html += `<p>${plan.description}</p>`;
    }
    html += `<h2>Weekly Training Plan Overview</h2>`;
    if (plan.workouts?.length) {
        plan.workouts.forEach((workout) => {
            html += generateFullWorkoutDescription(workout);
        });
    } else {
        html += `<p>No workouts in this plan.</p>`;
    }
    return html;
}

export function generateFullWorkoutDescription(workout: GeneratedWorkout): string {
    // Defensive: fallback for missing mapping keys
    const getSportTitle = (key: string) => sportTypes[key]?.title ?? key;
    const getStepTitle = (key: string) => stepTypes[key]?.title ?? key;

    let html = `<h2>${workout.dayOfWeek} - ${workout.workoutName} <span style="font-weight:normal;color:#aaa;">| ${getSportTitle(workout.sportType.sportTypeKey)}</span></h2>`;
    if (workout.justification) {
        html += `<p style="color:#8ca0b3;">${workout.justification}</p>`;
    }

    workout.workoutSegments.forEach((segment, segmentIdx) => {
        html += `<h3>Segment ${segmentIdx + 1}</h3>`;
        segment.workoutSteps.forEach((step, stepIdx) => {
            if (step.stepType.stepTypeKey === 'repeat') {
                html += `<h4>${stepIdx + 1}. Repeat block - ${getEndConditionValue(step)} iterations</h4>`;
                if (step.workoutSteps?.length) {
                    html += `<div style="margin-left:1em;border-left:2px solid #ccc;padding-left:1em;">`;
                    step.workoutSteps.forEach((subStep) => {
                        html += `<h5>${getStepTitle(subStep.stepType.stepTypeKey)}</h5>`;
                        if (subStep.description) html += `<p>${subStep.description}</p>`;
                        html += generateEndConditionDescription(subStep);
                        html += generateTargetDescription(subStep);
                    });
                    html += `</div>`;
                }
            } else {
                html += `<h4>${stepIdx + 1}. ${getStepTitle(step.stepType.stepTypeKey)}</h4>`;
                html += generateExerciseName(step);
                if (step.description) html += `<p>${step.description}</p>`;
                html += generateEndConditionDescription(step);
                html += generateTargetDescription(step);
            }
        });
    });

    return html;
}

export function getEndConditionValue(step: WorkoutStep): string | number {
    switch (step.endCondition?.conditionTypeKey) {
        case 'time':
            return formatDuration(step.endConditionValue);
        case 'iterations':
            return step.numberOfIterations ?? 'N/A';
        default:
            return step.endConditionValue ?? 'N/A';
    }
}

export function generateEndConditionDescription(step: WorkoutStep): string {
    const endConditionValue = step.endCondition?.conditionTypeKey ? getEndConditionValue(step) : 'N/A';

    return `<p class="text-secondary-400">End condition: ${step.endCondition?.conditionTypeKey ?? 'unknown'} - ${endConditionValue}</p>`;
}

export function generateTargetDescription(step: WorkoutStep): string {
    return step.targetType.workoutTargetTypeKey === 'no.target'
        ? ''
        : `<p class="text-warning-400">Target: ${targetTypes[step.targetType.workoutTargetTypeKey as keyof typeof targetTypes].label} - ${step.targetValueOne ?? ''} - ${step.targetValueTwo ?? ''} ${step.targetValueUnit ?? ''}</p>`;
}

export function generateExerciseName(step: WorkoutStep): string {
    const formatExerciseName = (exerciseName: string): string => {
        return exerciseName
            .toLowerCase() // Convert to lowercase: "dumbbell_row"
            .replace(/_/g, ' ') // Replace underscores with spaces: "dumbbell row"
            .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word: "Dumbbell Row"
    };
    return step.exerciseName ? `<h4 class="h6 font-bold">${formatExerciseName(step.exerciseName)}</h4>` : '';
}

function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0 && minutes > 0 && remainingSeconds > 0) {
        return `${hours}h ${minutes}min ${remainingSeconds}s`;
    } else if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}min`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else if (minutes > 0 && remainingSeconds > 0) {
        return `${minutes}min ${remainingSeconds}s`;
    } else if (minutes > 0) {
        return `${minutes}min`;
    } else {
        return `${remainingSeconds}s`;
    }
}

// Instead of returning HTML strings, return structured data
export function getEndConditionData(step: WorkoutStep) {
    const endConditionValue = step.endCondition?.conditionTypeKey ? getEndConditionValue(step) : 'N/A';

    return {
        conditionType: step.endCondition?.conditionTypeKey ?? 'unknown',
        value: endConditionValue,
        hasCondition: !!step.endCondition?.conditionTypeKey,
    };
}

export function getTargetData(step: WorkoutStep) {
    const isNoTarget = step.targetType.workoutTargetTypeKey === 'no.target';

    return {
        hasTarget: !isNoTarget,
        type: targetTypes[step.targetType.workoutTargetTypeKey as keyof typeof targetTypes]?.label,
        valueOne: step.targetValueOne ?? '',
        valueTwo: step.targetValueTwo ?? '',
        unit: step.targetValueUnit ?? '',
    };
}

export function getExerciseData(step: WorkoutStep) {
    if (!step.exerciseName) return null;

    const formatExerciseName = (exerciseName: string): string => {
        return exerciseName
            .toLowerCase()
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    return {
        name: formatExerciseName(step.exerciseName),
    };
}
