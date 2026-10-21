// The one outbound adapter from a planned session to a Garmin Connect workout (spec #409).
// Pure: pace as m/s, repeats one level deep, a step ceiling, strength load in the step description.
import { isRepeat, type RunBlock, type RunStep, type TypedSession } from '$lib/planner/core/session';

/** Garmin refuses or truncates long workouts; a planned session never needs more. */
export const GARMIN_STEP_CEILING = 50;

interface GarminSportType {
    sportTypeId: number;
    sportTypeKey: string;
}

export interface GarminStep {
    type: 'ExecutableStepDTO' | 'RepeatGroupDTO';
    stepOrder: number;
    stepType: { stepTypeId: number; stepTypeKey: string };
    endCondition: { conditionTypeId: number; conditionTypeKey: string };
    endConditionValue?: number;
    targetType?: { workoutTargetTypeId: number; workoutTargetTypeKey: string };
    targetValueOne?: number;
    targetValueTwo?: number;
    description?: string;
    numberOfIterations?: number;
    smartRepeat?: boolean;
    workoutSteps?: GarminStep[];
}

export interface GarminWorkout {
    workoutName: string;
    sportType: GarminSportType;
    workoutSegments: { segmentOrder: number; sportType: GarminSportType; workoutSteps: GarminStep[] }[];
}

export type AdaptResult =
    { ok: true; workout: GarminWorkout } | { ok: false; code: 'TOO_MANY_STEPS' | 'UNSUPPORTED_KIND'; message: string };

const SPORT = {
    running: { sportTypeId: 1, sportTypeKey: 'running' },
    strength: { sportTypeId: 5, sportTypeKey: 'strength_training' },
};
const INTERVAL = { stepTypeId: 3, stepTypeKey: 'interval' };
const REPEAT = { stepTypeId: 6, stepTypeKey: 'repeat' };
const LAP_BUTTON = { conditionTypeId: 1, conditionTypeKey: 'lap.button' };
const TIME = { conditionTypeId: 2, conditionTypeKey: 'time' };
const DISTANCE = { conditionTypeId: 3, conditionTypeKey: 'distance' };
const ITERATIONS = { conditionTypeId: 7, conditionTypeKey: 'iterations' };
const NO_TARGET = { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' };
const HR_ZONE = { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone' };
const PACE_ZONE = { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' };

const metresPerSecond = (secPerKm: number) => Math.round((1000 / secPerKm) * 1000) / 1000;

function runStep(step: RunStep): Omit<GarminStep, 'stepOrder'> {
    const out: Omit<GarminStep, 'stepOrder'> = {
        type: 'ExecutableStepDTO',
        stepType: INTERVAL,
        endCondition: step.durationSec != null ? TIME : DISTANCE,
        endConditionValue: step.durationSec ?? step.distanceM,
        targetType: NO_TARGET,
        description: [step.label, step.note].filter(Boolean).join(': '),
    };
    if (step.target?.type === 'PACE') {
        // Garmin orders a pace zone by speed: the slow end (most seconds per km) is value one.
        out.targetType = PACE_ZONE;
        out.targetValueOne = metresPerSecond(step.target.maxSecPerKm);
        out.targetValueTwo = metresPerSecond(step.target.minSecPerKm);
    } else if (step.target?.type === 'HR') {
        out.targetType = HR_ZONE;
        out.targetValueOne = step.target.lowerBpm;
        out.targetValueTwo = step.target.upperBpm;
    }
    return out;
}

/** A repeat stored inside a repeat is unrolled: Garmin groups stay one level deep. */
function flatSteps(blocks: RunBlock[]): RunStep[] {
    return blocks.flatMap((b) =>
        isRepeat(b) ? Array.from({ length: b.repeat }, () => flatSteps(b.steps)).flat() : [b],
    );
}

function repeatGroup(iterations: number, steps: Omit<GarminStep, 'stepOrder'>[]): Omit<GarminStep, 'stepOrder'> {
    return {
        type: 'RepeatGroupDTO',
        stepType: REPEAT,
        endCondition: ITERATIONS,
        endConditionValue: iterations,
        numberOfIterations: iterations,
        smartRepeat: false,
        workoutSteps: steps as GarminStep[],
    };
}

/** Numbers every step in document order, as Garmin expects; returns how many steps it numbered. */
function assignStepOrder(steps: Omit<GarminStep, 'stepOrder'>[], start = 1): number {
    let order = start;
    for (const s of steps as GarminStep[]) {
        s.stepOrder = order++;
        if (s.workoutSteps) order += assignStepOrder(s.workoutSteps, order);
    }
    return order - start;
}

/** A typed session without its place in the week: all the watch needs. */
export type GarminSource = TypedSession extends infer S
    ? S extends TypedSession
        ? Pick<S, 'kind' | 'body'>
        : never
    : never;

export function toGarminWorkout(session: GarminSource): AdaptResult {
    let sport: GarminSportType;
    let steps: Omit<GarminStep, 'stepOrder'>[];
    if (session.kind === 'RUNNING') {
        sport = SPORT.running;
        steps = session.body.steps.map((b) =>
            isRepeat(b) ? repeatGroup(b.repeat, flatSteps(b.steps).map(runStep)) : runStep(b),
        );
    } else if (session.kind === 'STRENGTH') {
        sport = SPORT.strength;
        steps = session.body.exercises.map((e) =>
            repeatGroup(e.sets, [
                {
                    type: 'ExecutableStepDTO',
                    stepType: INTERVAL,
                    endCondition: LAP_BUTTON,
                    targetType: NO_TARGET,
                    description: `${e.name}: ${e.reps} reps${e.load ? ` @ ${e.load}` : ''}`,
                },
            ]),
        );
    } else {
        return { ok: false, code: 'UNSUPPORTED_KIND', message: 'Only running and strength sessions go to Garmin' };
    }

    const count = assignStepOrder(steps);
    if (count > GARMIN_STEP_CEILING) {
        return {
            ok: false,
            code: 'TOO_MANY_STEPS',
            message: `This session has ${count} steps; Garmin takes at most ${GARMIN_STEP_CEILING}`,
        };
    }
    return {
        ok: true,
        workout: {
            workoutName: session.body.title.slice(0, 80),
            sportType: sport,
            workoutSegments: [{ segmentOrder: 1, sportType: sport, workoutSteps: steps as GarminStep[] }],
        },
    };
}
