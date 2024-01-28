import { db } from '$lib/database';
import type { Plan, User } from '@prisma/client';

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

export async function updateGeneratedPlansNumber(userId: string): Promise<number | Error> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { plans: true },
    });

    if (!user) {
        return new Error('User not found');
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
        return new Error('User not found');
    }
    return user.generatedPlansNumber;
}
