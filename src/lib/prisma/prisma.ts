import { db } from '$lib/database';
import { fail } from 'assert';
import NodeCache from 'node-cache';
import type { Plan, User } from '@prisma/client';

const cache = new NodeCache({ stdTTL: 120 });

type newPlan = {
    name: string;
    description: string;
    User: {
        connect: {
            id: string;
        };
    };
};

export async function addPlan(userId: string, plan: newPlan): Promise<Plan> {
    const newPlan = await db.plan.create({
        data: {
            ...plan,
        },
    });
    cache.del(`plans_${userId}`);

    return newPlan;
}

export async function deletePlan(planId: string, userId: string): Promise<Plan> {
    const plan = await db.plan.findUnique({
        where: { id: planId },
    });

    if (!plan) {
        return fail('Plan not found');
    }

    if (plan.userId !== userId) {
        return fail('User not authorized');
    }

    cache.del(`plans_${userId}`);
    return await db.plan.delete({
        where: {
            id: planId,
        },
    });
}

export async function updateGeneratedPlansNumber(userId: string): Promise<number | Error> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { plans: true },
    });

    if (!user) {
        return fail('User not found');
    }

    const plansCount = user.plans.length;

    await db.user.update({
        where: { id: userId },
        data: {
            generatedPlansNumber: plansCount,
        },
    });

    return plansCount;
}

export async function getGeneralPlanLimit(): Promise<number> {
    const generalPlanLimit = await db.configuration.findFirst({
        where: { name: 'generalPlanLimit' },
        select: { value: true },
    });

    return generalPlanLimit ? +generalPlanLimit.value : 0;
}

export async function updatePlanName(planId: string, newName: string): Promise<Plan> {
    return await db.plan.update({
        where: { id: planId },
        data: {
            name: newName,
        },
    });
}

export async function getPlans(userId: string): Promise<Plan[] | Error> {
    const cacheKey = `plans_${userId}`;
    const cachedPlans = cache.get(cacheKey);
    if (cachedPlans) return cachedPlans as Plan[];
    if (!userId) return fail('User not found');

    const plans = await db.plan.findMany({
        where: { userId: userId },
    });
    cache.set(cacheKey, plans);

    return plans;
}

export async function getPlan(planId: string, userId: string): Promise<Plan | null> {
    return await db.plan.findUnique({
        where: { userId: userId, id: planId },
    });
}

export async function incrementUserGeneretedPlans(userId: string): Promise<User> {
    return await db.user.update({
        where: { id: userId },
        data: {
            generatedPlansNumber: {
                increment: 1,
            },
        },
    });
}

export async function getGeneratedPlansNumber(userId: string): Promise<number | Error> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { generatedPlansNumber: true },
    });

    if (!user) {
        return fail('User not found');
    }
    return user.generatedPlansNumber;
}
