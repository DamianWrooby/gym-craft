// Planner persistence. Every write that creates a plan happens in one transaction (ADR 0012).
import { db } from '$lib/database';
import { addDays } from '$lib/utils/iso-week';
import type { Prisma } from '@prisma/client';
import type { NewPlanRecord, PlanningContext } from './build-plan';
import type { RaceResultInput } from './validation';

export class ActivePlanExistsError extends Error {
    constructor() {
        super('An active plan already exists');
    }
}

export class MissingProfileError extends Error {
    constructor() {
        super('Set up your athlete profile first');
    }
}

const asDate = (yyyymmdd: string) => new Date(`${yyyymmdd}T00:00:00Z`);

export async function getPlanningContext(userId: string, today: string): Promise<PlanningContext> {
    const [goals, raceResults, activities] = await Promise.all([
        db.runningGoal.findMany({ where: { userId, archivedAt: null }, orderBy: { priority: 'asc' } }),
        db.raceResult.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
        db.activity.findMany({
            where: { userId, startTime: { gte: asDate(addDays(today, -90)) } },
            select: {
                id: true,
                activityType: true,
                startTime: true,
                durationSec: true,
                movingDurationSec: true,
                distanceM: true,
            },
        }),
    ]);
    return { goals, raceResults, activities };
}

export async function persistNewPlan(userId: string, record: NewPlanRecord): Promise<{ id: string }> {
    const { layout } = record;
    try {
        return await db.$transaction(async (tx) => {
            const active = await tx.plan.count({ where: { userId, state: 'ACTIVE' } });
            if (active > 0) throw new ActivePlanExistsError();

            const profile = await tx.athleteProfile.findUnique({ where: { userId }, select: { id: true } });
            if (!profile) throw new MissingProfileError();
            await tx.athleteProfile.update({
                where: { userId },
                data: { hrZoneBounds: record.hrZoneBounds as unknown as Prisma.InputJsonValue },
            });

            if (record.raceResults.length > 0) {
                await tx.raceResult.createMany({
                    data: record.raceResults.map((r) => ({ ...r, userId, date: asDate(r.date) })),
                });
            }

            const plan = await tx.plan.create({
                data: {
                    userId,
                    goalId: record.goalId,
                    startDate: asDate(record.startDate),
                    endDate: asDate(record.endDate),
                    availability: record.availability,
                    longRunDay: record.longRunDay,
                    phases: {
                        create: layout.phases.map((p) => ({
                            key: p.key,
                            name: p.name,
                            ordinal: p.ordinal,
                            startDate: asDate(p.startDate),
                            endDate: asDate(p.endDate),
                            intent: p.intent,
                            source: p.source,
                            school: p.school,
                            volumeUnit: p.volumeUnit,
                            weeks: {
                                create: layout.weeks
                                    .filter((w) => w.phaseOrdinal === p.ordinal)
                                    .map((w) => ({
                                        userId,
                                        startDate: asDate(w.startDate),
                                        endDate: asDate(w.endDate),
                                        inHorizonDays: w.inHorizonDays,
                                        isCutback: w.isCutback,
                                        volumeTarget: w.volumeTarget,
                                        volumeUnit: w.volumeUnit,
                                        strengthSessionTarget: w.strengthSessionTarget,
                                    })),
                            },
                        })),
                    },
                },
                select: { id: true },
            });
            return plan;
        });
    } catch (e) {
        // The partial unique index catches a concurrent second create.
        if ((e as { code?: string })?.code === 'P2002') throw new ActivePlanExistsError();
        throw e;
    }
}

export async function getActivePlan(userId: string) {
    return db.plan.findFirst({
        where: { userId, state: 'ACTIVE' },
        include: {
            goal: true,
            phases: { orderBy: { ordinal: 'asc' }, include: { weeks: { orderBy: { startDate: 'asc' } } } },
        },
    });
}

export type ActivePlan = NonNullable<Awaited<ReturnType<typeof getActivePlan>>>;

export async function listRaceResults(userId: string) {
    return db.raceResult.findMany({ where: { userId }, orderBy: { date: 'desc' } });
}

export async function createRaceResult(userId: string, input: RaceResultInput) {
    return db.raceResult.create({ data: { ...input, userId, date: asDate(input.date) } });
}

export async function deleteRaceResult(userId: string, id: string): Promise<boolean> {
    const { count } = await db.raceResult.deleteMany({ where: { id, userId } });
    return count > 0;
}
