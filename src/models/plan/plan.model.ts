import { Prisma } from '@prisma/client';
import { stepTypes } from '@/garmin/mapping';

export interface NewPlan {
    name: string;
    description: string;
    workouts: Prisma.JsonArray;
    User: {
        connect: {
            id: string;
        };
    };
}

export interface Plan {
    id: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    name: string;
    description: string;
    workouts: GeneratedWorkout[];
}

interface SportType {
    sportTypeId: number;
    sportTypeKey: string;
    displayOrder: number;
}

interface StepType {
    stepTypeId: number;
    stepTypeKey: keyof typeof stepTypes;
    displayOrder: number;
}

interface EstimatedDistanceUnit {
    unitKey: string | null;
}

export interface WorkoutSegment {
    segmentOrder: number;
    sportType: SportType;
    workoutSteps: WorkoutStep[];
}

export interface EndCondition {
    conditionTypeId: number;
    conditionTypeKey: string;
    displayOrder: number;
    displayable: boolean;
}

interface TargetType {
    workoutTargetTypeId: number;
    workoutTargetTypeKey: string;
    displayOrder: number;
}

export interface WorkoutStep {
    stepId: number;
    stepOrder: number;
    stepType: StepType;
    type: string;
    category: string | null;
    exerciseName: string | null;
    endCondition: EndCondition;
    endConditionValue: number;
    numberOfIterations?: number;
    description: string;
    stepAudioNote: string | null;
    targetType: TargetType;
    targetValueOne?: number;
    targetValueTwo?: number;
    targetValueUnit?: string;
    workoutSteps?: WorkoutStep[];
}

export interface GarminWorkout {
    sportType: SportType;
    subSportType: SportType | null;
    workoutName: string;
    estimatedDistanceUnit: EstimatedDistanceUnit;
    workoutSegments: WorkoutSegment[];
    avgTrainingSpeed: number | null;
    estimatedDurationInSecs: number;
    estimatedDistanceInMeters: number;
    estimateType: string | null;
}

export interface GeneratedWorkout extends GarminWorkout {
    dayOfWeek: string;
    justification: string;
}