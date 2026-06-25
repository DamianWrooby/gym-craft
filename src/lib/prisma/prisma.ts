import { db } from '$lib/database';
import { currentMonthStartIso } from '$lib/utils/iso-week';
import { fail } from 'assert';
import NodeCache from 'node-cache';
import type { AthleteProfile, Plan, Prisma, ReportType, RunningGoal, TrainingReport, User } from '@prisma/client';
import type { NewPlan } from '../../models/plan/plan.model';
import bcrypt from 'bcrypt';

const cache = new NodeCache({ stdTTL: 120 });

const athleteProfileKey = (userId: string) => `athlete_profile_${userId}`;
const runningGoalsKey = (userId: string, includeArchived: boolean) =>
    `running_goals_${includeArchived ? 'all' : 'active'}_${userId}`;
const trainingReportsKey = (userId: string) => `training_reports_${userId}`;

function invalidateAthleteProfile(userId: string): void {
    cache.del(athleteProfileKey(userId));
}

function invalidateRunningGoals(userId: string): void {
    cache.del(runningGoalsKey(userId, true));
    cache.del(runningGoalsKey(userId, false));
}

function invalidateTrainingReports(userId: string): void {
    cache.del(trainingReportsKey(userId));
}

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

export async function updatePlanName(planId: string, newName: string, userId: string): Promise<void> {
    const result = await db.plan.updateMany({
        where: { id: planId, userId },
        data: { name: newName },
    });

    if (result.count === 0) {
        return fail('Plan not found or not authorized');
    }

    cache.del(`plans_${userId}`);
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

/** Returns the user's stored Garmin session token (Bearer), or null if not yet authenticated. */
export async function getGarminSessionToken(userId: string): Promise<string | null> {
    const row = await db.garminData.findUnique({
        where: { userId },
        select: { sessionToken: true },
    });
    return row?.sessionToken ?? null;
}

/** Persists the Garmin session token issued by the microservice's /authenticate. */
export async function saveGarminSessionToken(userId: string, sessionToken: string): Promise<void> {
    await db.garminData.update({
        where: { userId },
        data: { sessionToken },
    });
}

/** Clears the stored Garmin session token (e.g. after the microservice reports it expired). */
export async function clearGarminSessionToken(userId: string): Promise<void> {
    await db.garminData.updateMany({
        where: { userId },
        data: { sessionToken: null },
    });
}

export async function getAthleteProfile(userId: string): Promise<AthleteProfile | null> {
    const key = athleteProfileKey(userId);
    const cached = cache.get<AthleteProfile | null>(key);
    if (cached !== undefined) return cached;

    const profile = await db.athleteProfile.findUnique({ where: { userId } });
    cache.set(key, profile);
    return profile;
}

export type AthleteProfileInput = Omit<Prisma.AthleteProfileUncheckedCreateInput, 'id' | 'userId' | 'updatedAt'>;

export async function upsertAthleteProfile(userId: string, data: AthleteProfileInput): Promise<AthleteProfile> {
    const profile = await db.athleteProfile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
    });
    invalidateAthleteProfile(userId);
    return profile;
}

export async function getRunningGoals(
    userId: string,
    options: { includeArchived?: boolean } = {},
): Promise<RunningGoal[]> {
    const includeArchived = options.includeArchived ?? false;
    const key = runningGoalsKey(userId, includeArchived);
    const cached = cache.get<RunningGoal[]>(key);
    if (cached !== undefined) return cached;

    const goals = await db.runningGoal.findMany({
        where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    cache.set(key, goals);
    return goals;
}

export type RunningGoalCreateInput = Omit<
    Prisma.RunningGoalUncheckedCreateInput,
    'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

export async function createRunningGoal(userId: string, data: RunningGoalCreateInput): Promise<RunningGoal> {
    const goal = await db.runningGoal.create({ data: { userId, ...data } });
    invalidateRunningGoals(userId);
    return goal;
}

export type RunningGoalUpdateInput = Partial<RunningGoalCreateInput>;

export async function updateRunningGoal(
    goalId: string,
    userId: string,
    data: RunningGoalUpdateInput,
): Promise<RunningGoal | null> {
    const result = await db.runningGoal.updateMany({
        where: { id: goalId, userId },
        data,
    });
    if (result.count === 0) return null;
    invalidateRunningGoals(userId);
    return await db.runningGoal.findUnique({ where: { id: goalId } });
}

export async function archiveRunningGoal(goalId: string, userId: string): Promise<boolean> {
    const result = await db.runningGoal.updateMany({
        where: { id: goalId, userId, archivedAt: null },
        data: { archivedAt: new Date() },
    });
    if (result.count === 0) return false;
    invalidateRunningGoals(userId);
    return true;
}

export async function getRunningGoalsByIds(
    userId: string,
    goalIds: string[],
    options: { includeArchived?: boolean } = {},
): Promise<RunningGoal[]> {
    if (goalIds.length === 0) return [];
    const includeArchived = options.includeArchived ?? false;
    return await db.runningGoal.findMany({
        where: {
            userId,
            id: { in: goalIds },
            ...(includeArchived ? {} : { archivedAt: null }),
        },
    });
}

export async function getWeeklyReports(userId: string): Promise<TrainingReport[]> {
    const key = trainingReportsKey(userId);
    const cached = cache.get<TrainingReport[]>(key);
    if (cached !== undefined) return cached;

    const reports = await db.trainingReport.findMany({
        where: { userId, type: 'WEEKLY' },
        orderBy: { periodStart: 'desc' },
        take: 52,
    });
    cache.set(key, reports);
    return reports;
}

export async function getReportById(reportId: string, userId: string): Promise<TrainingReport | null> {
    const report = await db.trainingReport.findUnique({ where: { id: reportId } });
    if (!report || report.userId !== userId) return null;
    return report;
}

export async function getMonthlyWeeklyReportCount(userId: string): Promise<number> {
    // NOT cached — the increment write is the source of truth; this read is a
    // fail-fast hint for the pre-flight cap check in the API handler.
    const monthKey = currentMonthStartIso();
    const row = await db.aiUsage.findUnique({
        where: { userId_kind_day: { userId, kind: 'weekly_report', day: monthKey } },
        select: { count: true },
    });
    return row?.count ?? 0;
}

export interface PersistTrainingReportInput {
    userId: string;
    type: ReportType;
    periodStart: string;
    periodEnd: string;
    metrics: Prisma.InputJsonValue;
    summary: string;
    goalContext: Prisma.InputJsonValue;
}

/**
 * Persists a weekly training report and (when consumeSlot is true) increments the
 * user's AiUsage counter for the current calendar month. Empty-week reports are
 * saved with consumeSlot: false so they do not eat a monthly slot.
 *
 * The cap is enforced at the API layer via a pre-flight read; this function does
 * not re-check it. The race window is acceptable because the cap is 4/month and
 * report generation takes seconds (LLM call + Garmin sync).
 */
export async function persistTrainingReport(
    input: PersistTrainingReportInput,
    options: { consumeSlot: boolean } = { consumeSlot: true },
): Promise<TrainingReport> {
    const { userId, type, periodStart, periodEnd, metrics, summary, goalContext } = input;
    const reportPayload = { userId, type, periodStart, periodEnd, metrics, summary, goalContext };
    const monthKey = currentMonthStartIso();

    const report = await db.$transaction(async (tx) => {
        if (options.consumeSlot) {
            await tx.aiUsage.upsert({
                where: { userId_kind_day: { userId, kind: 'weekly_report', day: monthKey } },
                create: { userId, kind: 'weekly_report', day: monthKey, count: 1 },
                update: { count: { increment: 1 } },
            });
        }

        return await tx.trainingReport.upsert({
            where: { userId_type_periodStart: { userId, type, periodStart } },
            create: reportPayload,
            update: { ...reportPayload, createdAt: new Date() },
        });
    });

    invalidateTrainingReports(userId);
    return report;
}

export async function findExistingReport(
    userId: string,
    type: ReportType,
    periodStart: string,
): Promise<TrainingReport | null> {
    return await db.trainingReport.findUnique({
        where: { userId_type_periodStart: { userId, type, periodStart } },
    });
}
