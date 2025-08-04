import { db } from '$lib/database';
import { fail } from 'assert';
import NodeCache from 'node-cache';
import type { Plan, User } from '@prisma/client';
import type { NewPlan } from '../../models/plan/plan.model';
import bcrypt from 'bcrypt';

const cache = new NodeCache({ stdTTL: 120 });

export async function getUserBySession(session: string): Promise<Pick<User, 'id'>> {
    const user = await db.user.findUnique({
        where: { userAuthToken: session },
        select: {
            id: true,
        },
    });
    if (!user) {
        return fail('User not found');
    }
    return user;
}

export async function addPlan(userId: string, plan: NewPlan): Promise<Plan> {
    const createdPlan = await db.plan.create({
        data: {
            ...plan,
        },
    });
    cache.del(`plans_${userId}`);

    return createdPlan;
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
    });

    if (!user) {
        return fail('User not found');
    }

    const generatedPlansNumber = user.generatedPlansNumber;
    const newGeneratedPlansNumber = generatedPlansNumber + 1;

    await db.user.update({
        where: { id: userId },
        data: {
            generatedPlansNumber: newGeneratedPlansNumber,
        },
    });

    return newGeneratedPlansNumber;
}

export async function getGeneralPlanLimit(): Promise<number> {
    const generalPlanLimit = await db.configuration.findFirst({
        where: { name: 'generalPlanLimit' },
        select: { value: true },
    });

    return generalPlanLimit ? +generalPlanLimit.value : 0;
}

export async function updatePlanName(planId: string, newName: string, userId: string): Promise<Plan> {
    cache.del(`plans_${userId}`);
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

export async function getGeneratedPlansNumber(userId: string): Promise<number> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { generatedPlansNumber: true },
    });

    if (!user) return -1;
    return user.generatedPlansNumber;
}

export async function verifyToken(userId: string, token: string): Promise<boolean> {
    const verificationToken = await db.verificationToken.findFirst({
        where: {
            userId: userId,
            isUsed: false,
            expiresAt: {
                gte: new Date(Date.now()),
            },
        },
    });

    if (!verificationToken) throw new Error('Invalid or expired token');

    const isMatch = await bcrypt.compare(token, verificationToken.tokenHash);
    if (!isMatch) throw new Error('Invalid token');

    // Mark the token as used
    await db.verificationToken.update({
        where: {
            id: verificationToken.id,
        },
        data: {
            isUsed: true,
            usedAt: new Date(),
        },
    });

    // Verify the user's account
    await db.user.update({
        where: {
            id: verificationToken.userId,
        },
        data: {
            emailVerified: true,
        },
    });

    console.log('User verified successfully');
    return true;
}

export async function invalidatePreviousToken(userId: string): Promise<boolean> {
    const verificationToken = await db.verificationToken.findFirst({
        where: {
            userId: userId,
            isUsed: false,
            expiresAt: {
                gte: new Date(Date.now()),
            },
        },
    });
    if (!verificationToken) return false;

    await db.verificationToken.update({
        where: {
            id: verificationToken.id,
            userId: userId,
            isUsed: false,
        },
        data: {
            isUsed: true,
            usedAt: new Date(),
        },
    });

    return true;
}

export async function getGarminEmail(userId: string): Promise<string | false> {
    const credentials = await db.garminData.findUnique({
        where: { userId: userId },
        select: {
            email: true,
        },
    });
    const email = credentials?.email;

    if (!credentials || !email) return false;

    return email;
}

export async function saveGarminEmail(userId: string, garminEmail: string): Promise<boolean> {
    const existing = await db.garminData.findUnique({
        where: { userId },
    });

    if (!existing) {
        await db.garminData.create({
            data: {
                userId,
                email: garminEmail,
            },
        });
    } else {
        await db.garminData.update({
            where: { userId },
            data: { email: garminEmail },
        });
    }

    return true;
}
