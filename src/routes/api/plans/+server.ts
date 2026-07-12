import type { NewPlan, Plan } from './../../../models/plan/plan.model';
import {
    addPlan,
    getGeneralPlanLimit,
    getGeneratedPlansNumber,
    getMonthlyGymPlanCount,
    incrementMonthlyGymPlanCount,
    updateGeneratedPlansNumber,
} from '$lib/prisma/prisma';
import { createResponse } from '$lib/utils/response';
import { getAuthenticatedUser } from '$lib/server/auth';
import { getLimit } from '@/constants/subscription.constants';
import { to } from 'await-to-js';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent): Promise<Response> {
    const user = getAuthenticatedUser(event);
    const body = await event.request.json();
    const { plan }: { plan: Plan } = body;
    const userId = user.id;
    const tier = event.locals.user.subscriptionTier;
    const monthlyCap = getLimit(tier, 'gymPlansPerMonth');

    // Pre-flight cap check: supporters get a monthly allowance; free users keep
    // the legacy lifetime cap (Configuration limit − generatedPlansNumber).
    let generatedPlansNumber = -1;
    let monthlyCount = 0;
    if (monthlyCap !== null) {
        const [countError, count] = await to(getMonthlyGymPlanCount(userId));
        if (countError) return createResponse(400, { message: 'Cannot retrieve information about generated plans' });
        monthlyCount = count ?? 0;
        if (monthlyCount >= monthlyCap) {
            return createResponse(400, { message: 'You have reached the limit of generated plans' });
        }
    } else {
        const [plansMetaError, results] = await to(
            Promise.all([getGeneralPlanLimit(), getGeneratedPlansNumber(userId)]),
        );
        if (plansMetaError) {
            return createResponse(400, { message: 'Cannot retrieve information about generated plans' });
        }
        const [generalPlanLimit, currentPlansNumber] = results ?? [0, -1];
        generatedPlansNumber = currentPlansNumber;
        if (currentPlansNumber === -1 || currentPlansNumber >= generalPlanLimit) {
            return createResponse(400, { message: 'You have reached the limit of generated plans' });
        }
    }

    // Add plan to the database
    const newPlan: NewPlan = {
        name: 'Plan ' + (monthlyCap !== null ? Date.now() : generatedPlansNumber),
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

    // Both counters advance: generatedPlansNumber remains the lifetime stat (and the
    // number a canceled supporter falls back to); AiUsage tracks the monthly slot.
    const updatedPlansNumber = await updateGeneratedPlansNumber(userId);

    let plansLeft: number;
    if (monthlyCap !== null) {
        await incrementMonthlyGymPlanCount(userId);
        plansLeft = Math.max(0, monthlyCap - (monthlyCount + 1));
    } else {
        const generalPlanLimit = await getGeneralPlanLimit();
        plansLeft = typeof updatedPlansNumber === 'number' ? generalPlanLimit - updatedPlansNumber : 0;
    }

    const responseBody = {
        generatedPlan: savedPlan,
        plansLeft,
    };

    return createResponse(200, responseBody);
}
