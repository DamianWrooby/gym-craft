import { GeneratedWorkout, NewPlan, Plan, WorkoutSegment, WorkoutStep } from './../../../models/plan/plan.model';
import { addPlan, getGeneralPlanLimit, updateGeneratedPlansNumber, getGeneratedPlansNumber } from '$lib/prisma/prisma';
import { createResponse } from '$lib/utils/response';
import { PUBLIC_APP_ENV } from '$env/static/public';
import { appConfig } from '@/constants/app.constants';
import { to } from 'await-to-js';
import { SurveyFormModel } from './../../../models/survey/survey-form.model';
import { exerciseMap, workoutCategoriesSet } from '@/constants/workout.constants';
import type { RequestEvent } from './$types';

export async function POST({ request }: RequestEvent): Promise<Response> {
    const body = await request.json();
    const userId = body.user.id;
    const userSession = body.user.session;
    const { formData }: { formData: SurveyFormModel } = body;
    const proxyAPIurl = PUBLIC_APP_ENV === 'development' ? appConfig.proxyApiUrlDEV : appConfig.proxyApiUrlPROD;
    const retryCount = 2;

    // Check if user has plans left
    const [plansMetaError, results] = await to(Promise.all([getGeneralPlanLimit(), getGeneratedPlansNumber(userId)]));
    if (plansMetaError) return createResponse(400, { message: 'Cannot retrieve information about generated plans' });
    const [generalPlanLimit, generatedPlansNumber] = results ?? [0, -1];

    if (generatedPlansNumber === -1 || generatedPlansNumber >= generalPlanLimit) {
        return createResponse(400, { message: 'You have reached the limit of generated plans' });
    }

    // Proxy server call
    const requestBody = JSON.stringify({
        session: userSession,
        formData,
    });

    const validPlan = await tryGenerateValidPlan(retryCount, proxyAPIurl, requestBody);

    if (!validPlan) {
        return createResponse(502, { message: 'Failed to generate a valid plan after maximum retries' });
    }

    // Add plan to the database
    const newPlan: NewPlan = {
        name: 'Plan ' + generatedPlansNumber,
        description: validPlan.description,
        workouts: JSON.parse(JSON.stringify(validPlan.workouts)),
        User: {
            connect: {
                id: userId,
            },
        },
    };

    const [addPlanError, savedPlan] = await to(addPlan(userId, newPlan));
    if (addPlanError) return createResponse(400, { message: 'Cannot save the  plan in the database' });

    const updatedPlansNumber = await updateGeneratedPlansNumber(userId);
    const plansLeft = typeof updatedPlansNumber === 'number' ? generalPlanLimit - updatedPlansNumber : 0;

    const responseBody = {
        generatedPlan: savedPlan,
        plansLeft,
    };

    return createResponse(200, responseBody);
}

async function tryGenerateValidPlan(retries: number, url: string, body: string): Promise<Plan | null> {
    for (let i = 0; i < retries; i++) {
        const plan = await generatePlan(url, body);
        if (!plan) {
            console.log(`Failed to generate plan - retrying (${i + 1}/${retries})`);
            continue;
        }

        const improvedPlan = correctPlan(plan);
        const isValid = isValidPlan(improvedPlan);

        if (isValid) {
            console.log('Generated plan is valid');
            return improvedPlan;
        } else {
            console.log(`Generated plan is not valid - retrying (${i + 1}/${retries})`);
            continue;
        }
    }
    return null;
}

async function generatePlan(url: string, body: string): Promise<Plan | null> {
    const [proxyError, proxyResponse] = await fetchPlanFromProxyServer(url, body);
    if (proxyError || !proxyResponse?.ok) return null;
    const generatedPlan: Plan = await proxyResponse?.json();

    return generatedPlan;
}

async function fetchPlanFromProxyServer(
    url: string,
    body: string,
): Promise<[null, Response] | [Error | null, undefined]> {
    return await to(
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: body,
        }),
    );
}

function correctPlan(plan: Plan): Plan {
    const isPassiveStep = (step: WorkoutStep): boolean => 
        step.stepType.stepTypeId === 5 || step.stepType.stepTypeId === 4 || step.stepType.stepTypeId === 2;

    const categoryCorrect = (step: WorkoutStep): boolean => {
        if (!step.category) return false;
        return workoutCategoriesSet.has(step.category);
    }

    const exerciseNameCorrect = (step: WorkoutStep): boolean => {
        if (!step.exerciseName || !step.category) return false;
        const exercises = exerciseMap.get(step.category);
        return !!exercises && exercises.has(step.exerciseName);
    };

    // Ensure if category and exerciseName are null if stepType is cooldown, rest or recovery
    plan.workouts.forEach((workout: GeneratedWorkout) => {
        workout.workoutSegments.forEach((segment: WorkoutSegment) => {
            segment.workoutSteps.forEach((step: WorkoutStep) => {
                if (isPassiveStep(step) && (step.category || step.exerciseName)) {
                    console.log('Correcting step:', step);
                    step.category = null;
                    step.exerciseName = null;
                }
                console.log('Correcting step:', step);
                if (!isPassiveStep(step) && categoryCorrect(step) && !exerciseNameCorrect(step)) {
                    step.exerciseName = exerciseMap.get(step.category!)?.values().next().value || null;
                }
            });
        });
    });
    return plan;
}

function isValidPlan(plan: Plan): boolean {
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
            console.log('Invalid step:', step);
            return false;
        }
        return !!exerciseMap.get(step.category)?.has(step.exerciseName);
    }
}
