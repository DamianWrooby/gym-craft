import { db } from '$lib/database';
import type { Plan, User } from '@prisma/client';
import { fail } from 'assert';

type newPlan = {
    name: string;
    description: string;
    User: {
        connect: {
            id: string;
        };
    };
};

export async function addPlan(plan: newPlan): Promise<Plan> {
    return await db.plan.create({
        data: {
            ...plan,
        },
    });
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

export async function updatePlanName(planId: string, newName: string): Promise<Plan> {
    return await db.plan.update({
        where: { id: planId },
        data: {
            name: newName,
        },
    });
}

export async function getPlans(userId: string): Promise<Plan[]> {
    return await db.plan.findMany({
        where: { userId: userId },
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
