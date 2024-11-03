import { addPlan, getGeneralPlanLimit, updateGeneratedPlansNumber, getGeneratedPlansNumber } from '$lib/prisma/prisma';
import { createErrorResponse } from '$lib/utils/error-response';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function POST({ request }: RequestEvent): Promise<Response> {
    const body = await request.json();
    const userId = body.user.id;
    const { planContent }: { planContent: string } = body;

    const [generalPlanLimit, generatedPlansNumber] = await Promise.all([
        getGeneralPlanLimit(),
        getGeneratedPlansNumber(userId),
    ]);

    if (generatedPlansNumber === -1 || generatedPlansNumber >= generalPlanLimit) {
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
