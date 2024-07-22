import { addPlan, getGeneralPlanLimit, updateGeneratedPlansNumber } from '$lib/prisma/prisma';
import { createErrorResponse } from '$lib/utils/error-response';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function POST({ request }: RequestEvent): Promise<Response> {
    const body = await request.json();
    const { generatedPlansNumber }: { generatedPlansNumber: number } = body.user;
    const userId = body.user.id;
    const { planContent }: { planContent: string } = body;

    const generalPlanLimit = await getGeneralPlanLimit();

    if (generatedPlansNumber >= generalPlanLimit) {
        return createErrorResponse(400, 'No plans left');
    }

    const plan = {
        name: 'Plan ' + generatedPlansNumber,
        description: planContent,
        User: {
            connect: {
                id: userId,
            },
        },
    };

    const generatedPlan = await addPlan(userId, plan);
    const newGeneratedPlansNumber = await updateGeneratedPlansNumber(userId);
    const plansLeft = typeof newGeneratedPlansNumber === 'number' ? generalPlanLimit - newGeneratedPlansNumber : 0;

    const responseBody = {
        generatedPlan: generatedPlan,
        generatedPlansNumber: newGeneratedPlansNumber,
        plansLeft,
    };

    return json(responseBody);
}

export async function GET(): Promise<Response> {
    const generalPlanLimit = await getGeneralPlanLimit();
    const responseBody = {
        generalPlanLimit,
    };

    return json(responseBody);
}
