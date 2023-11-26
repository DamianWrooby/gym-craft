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

export async function incrementUserGeneretedPlans(userId: string): Promise<User> {
    return await db.user.update({
        where: { id: userId },
        data: {
            generatedPlans: {
                increment: 1,
            },
        },
    });
}
