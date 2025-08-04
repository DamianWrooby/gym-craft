import { NewPlan, Plan } from './../../../models/plan/plan.model';
import { addPlan, getGeneralPlanLimit, updateGeneratedPlansNumber, getGeneratedPlansNumber } from '$lib/prisma/prisma';
import { createResponse } from '$lib/utils/response';
import { getUserBySession } from '$lib/prisma/prisma';
import { to } from 'await-to-js';
import type { RequestEvent } from './$types';

export async function POST({ request }: RequestEvent): Promise<Response> {
    const body = await request.json();
    const { session }: { session: string } = body;
    const { plan }: { plan: Plan } = body;

    // Check user
    const [userError, user] = await to(getUserBySession(session));
    if (userError || user.id == null) return createResponse(400, { message: 'User error' });
    const userId = user.id;

    // Check if user has plans left
    const [plansMetaError, results] = await to(Promise.all([getGeneralPlanLimit(), getGeneratedPlansNumber(userId)]));
    if (plansMetaError) return createResponse(400, { message: 'Cannot retrieve information about generated plans' });
    const [generalPlanLimit, generatedPlansNumber] = results ?? [0, -1];

    if (generatedPlansNumber === -1 || generatedPlansNumber >= generalPlanLimit) {
        return createResponse(400, { message: 'You have reached the limit of generated plans' });
    }

    // Add plan to the database
    const newPlan: NewPlan = {
        name: 'Plan ' + generatedPlansNumber,
        description: plan.description,
        workouts: JSON.parse(JSON.stringify(plan.workouts)),
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
