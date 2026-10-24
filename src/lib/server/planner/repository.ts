// Planner persistence. Every write that creates a plan happens in one transaction (ADR 0012).
import { db } from '$lib/database';
import { addDays, fromIsoDate } from '$lib/utils/iso-week';
import type { Prisma } from '@prisma/client';
import type { NewPlanRecord, PlanningContext } from './build-plan';
import type { AiRequestInput } from './week-prompt';
import type { StruckBudget } from './budget';
import type { LaidWeek, Layout } from '$lib/planner/core/layout';

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

/** A laid-out week as a `PlanWeek` row; shared by plan creation and the recut. */
export function laidWeekRow(userId: string, w: LaidWeek, timeTrial: Layout['timeTrial']) {
    return {
        userId,
        startDate: fromIsoDate(w.startDate),
        endDate: fromIsoDate(w.endDate),
        inHorizonDays: w.inHorizonDays,
        isCutback: w.isCutback,
        isTaper: w.isTaper,
        timeTrialDistanceM: timeTrial?.weekIndex === w.index ? timeTrial.distanceM : null,
        volumeTarget: w.volumeTarget,
        volumeUnit: w.volumeUnit,
        strengthSessionTarget: w.strengthSessionTarget,
    };
}

export async function getPlanningContext(userId: string, today: string): Promise<PlanningContext> {
    const [goals, raceResults, activities] = await Promise.all([
        db.runningGoal.findMany({ where: { userId, archivedAt: null }, orderBy: { priority: 'asc' } }),
        db.raceResult.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
        db.activity.findMany({
            where: { userId, startTime: { gte: fromIsoDate(addDays(today, -90)) } },
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

export interface NewAiRequest {
    model: string;
    input: AiRequestInput;
    /** Week 1's recovery budget, struck at creation with no outlook (factor 1). */
    budget: StruckBudget;
}

export interface CreatedPlan {
    id: string;
    /** Week 1, which the bootstrap AI request writes. */
    weekId: string;
    aiRequestId: string;
}

/** Writes the horizon and week 1's AI request together, so a plan never exists without it. */
export async function persistNewPlan(userId: string, record: NewPlanRecord, week1: NewAiRequest): Promise<CreatedPlan> {
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
                    data: record.raceResults.map((r) => ({ ...r, userId, date: fromIsoDate(r.date) })),
                });
            }

            const plan = await tx.plan.create({
                data: {
                    userId,
                    goalId: record.goalId,
                    startDate: fromIsoDate(record.startDate),
                    endDate: fromIsoDate(record.endDate),
                    availability: record.availability,
                    longRunDay: record.longRunDay,
                    rationale: record.rationale as unknown as Prisma.InputJsonValue,
                    phases: {
                        create: layout.phases.map((p) => ({
                            key: p.key,
                            name: p.name,
                            ordinal: p.ordinal,
                            startDate: fromIsoDate(p.startDate),
                            endDate: fromIsoDate(p.endDate),
                            intent: p.intent,
                            source: p.source,
                            school: p.school,
                            volumeUnit: p.volumeUnit,
                            weeks: {
                                create: layout.weeks
                                    .filter((w) => w.phaseOrdinal === p.ordinal)
                                    .map((w) => laidWeekRow(userId, w, layout.timeTrial)),
                            },
                        })),
                    },
                },
                select: {
                    id: true,
                    phases: {
                        orderBy: { ordinal: 'asc' },
                        select: { weeks: { orderBy: { startDate: 'asc' }, select: { id: true } } },
                    },
                },
            });

            const weekId = plan.phases[0].weeks[0].id;
            const request = await tx.aiRequest.create({
                data: { userId, model: week1.model, input: week1.input as unknown as Prisma.InputJsonValue },
                select: { id: true },
            });
            await tx.planWeek.update({
                where: { id: weekId },
                data: { aiRequestId: request.id, outlookFactor: 1, ...week1.budget },
            });
            return { id: plan.id, weekId, aiRequestId: request.id };
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
            phases: {
                orderBy: { ordinal: 'asc' },
                include: {
                    weeks: {
                        orderBy: { startDate: 'asc' },
                        include: {
                            aiRequest: { select: { id: true, status: true, retryCount: true } },
                            revisionRequest: { select: { id: true, status: true, retryCount: true } },
                            sessions: {
                                where: { status: { not: 'SUPERSEDED' } },
                                orderBy: [{ scheduledDate: 'asc' }, { sequence: 'asc' }],
                            },
                        },
                    },
                },
            },
        },
    });
}

export type ActivePlan = NonNullable<Awaited<ReturnType<typeof getActivePlan>>>;
