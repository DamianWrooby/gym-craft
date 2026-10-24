// Athlete-owned changes to planned sessions (spec #409, stories 33–38, 65). The app never
// overwrites an athlete session: editing an AI session supersedes it with an `ATHLETE` row.
import { db } from '$lib/database';
import { toIsoDate, fromIsoDate } from '$lib/utils/iso-week';
import { getSchool, isSchoolId } from '$lib/planner/schools/catalogue';
import { readAthleteSession } from '$lib/planner/core/athlete-session';
import { attachTargets } from '$lib/planner/core/targets';
import type { TypedSession } from '$lib/planner/core/session';
import type { Cost } from '$lib/planner/core/cost';
import type { Prisma } from '@prisma/client';
import type { GarminSource } from '$lib/server/garmin/workout-adapter';
import { athleteSessionContext } from './cost-context';

export type SessionWriteOutcome =
    | { kind: 'not-found' }
    | { kind: 'invalid'; errors: string[] }
    | { kind: 'outside-plan' }
    | { kind: 'locked'; reason: string }
    | { kind: 'saved'; sessionId: string };

/** The athlete may confirm, skip, or reopen a session the evidence has not already settled. */
export type SessionMark = 'DONE' | 'SKIPPED' | 'PLANNED';
export const SESSION_MARKS: readonly SessionMark[] = ['DONE', 'SKIPPED', 'PLANNED'];

/** A solo time trial slower than this is not a race result. */
const MAX_TIME_TRIAL_SEC = 6 * 3600;

async function activePlanWeeks(userId: string) {
    return db.plan.findFirst({
        where: { userId, state: 'ACTIVE' },
        include: { goal: true, phases: { include: { weeks: true } } },
    });
}

type ActivePlan = NonNullable<Awaited<ReturnType<typeof activePlanWeeks>>>;

/** The plan week (and its phase) holding a date, or null outside the horizon. */
function weekOn(plan: ActivePlan, date: string) {
    for (const phase of plan.phases) {
        for (const week of phase.weeks) {
            if (date >= toIsoDate(week.startDate) && date <= toIsoDate(week.endDate)) return { phase, week };
        }
    }
    return null;
}

async function readFor(
    userId: string,
    plan: ActivePlan,
    raw: unknown,
    today: string,
): Promise<
    { ok: true; session: TypedSession; cost: Cost; weekId: string } | { ok: false; outcome: SessionWriteOutcome }
> {
    const date = (raw as { date?: unknown } | null)?.date;
    const found = typeof date === 'string' ? weekOn(plan, date) : null;
    if (!found) return { ok: false, outcome: { kind: 'outside-plan' } };
    if (!isSchoolId(found.phase.school)) throw new Error(`Unknown school on phase: ${found.phase.school}`);
    const ctx = await athleteSessionContext(userId, getSchool(found.phase.school), plan.goal.targetDistanceM, today);
    const read = readAthleteSession(raw, ctx.cost);
    if (!read.ok) return { ok: false, outcome: { kind: 'invalid', errors: read.errors } };
    const [session] = attachTargets([read.session], ctx.targets);
    return { ok: true, session, cost: read.cost, weekId: found.week.id };
}

function rowData(userId: string, weekId: string, session: TypedSession, cost: Cost, sequence: number) {
    return {
        userId,
        planWeekId: weekId,
        kind: session.kind,
        scheduledDate: fromIsoDate(session.scheduledDate),
        sequence,
        origin: 'ATHLETE' as const,
        plannedLoad: cost.plannedLoad,
        loadMethod: cost.method,
        body: session.body as unknown as Prisma.InputJsonValue,
        bodyVersion: session.body.bodyVersion,
    };
}

async function nextSequence(userId: string, date: string): Promise<number> {
    return db.plannedSession.count({
        where: { userId, scheduledDate: fromIsoDate(date), status: { not: 'SUPERSEDED' } },
    });
}

/** One control for every kind (story 33); costed before it happens (story 34). */
export async function addSession(userId: string, raw: unknown, today: string): Promise<SessionWriteOutcome> {
    const plan = await activePlanWeeks(userId);
    if (!plan) return { kind: 'not-found' };
    const read = await readFor(userId, plan, raw, today);
    if (!read.ok) return read.outcome;
    const sequence = await nextSequence(userId, read.session.scheduledDate);
    const created = await db.plannedSession.create({
        data: rowData(userId, read.weekId, read.session, read.cost, sequence),
        select: { id: true },
    });
    return { kind: 'saved', sessionId: created.id };
}

/** An AI session is superseded by the edit; the athlete's own session is edited in place (story 35). */
export async function editSession(
    userId: string,
    sessionId: string,
    raw: unknown,
    today: string,
): Promise<SessionWriteOutcome> {
    const existing = await db.plannedSession.findUnique({ where: { id: sessionId } });
    if (!existing || existing.userId !== userId) return { kind: 'not-found' };
    if (existing.status !== 'PLANNED') return { kind: 'locked', reason: 'Only a planned session can be edited' };

    const plan = await activePlanWeeks(userId);
    if (!plan) return { kind: 'not-found' };
    const read = await readFor(userId, plan, { ...(raw as object), kind: existing.kind }, today);
    if (!read.ok) return read.outcome;

    const sameDay = read.session.scheduledDate === toIsoDate(existing.scheduledDate);
    const sequence = sameDay ? existing.sequence : await nextSequence(userId, read.session.scheduledDate);
    const data = rowData(userId, read.weekId, read.session, read.cost, sequence);

    if (existing.origin === 'ATHLETE') {
        const updated = await db.plannedSession.updateMany({ where: { id: existing.id, status: 'PLANNED' }, data });
        if (updated.count === 0) return { kind: 'locked', reason: 'This session changed meanwhile' };
        return { kind: 'saved', sessionId: existing.id };
    }
    const createdId = await db.$transaction(async (tx) => {
        // Claiming only a still-planned row keeps one successor per AI session, even under a race.
        const claimed = await tx.plannedSession.updateMany({
            where: { id: existing.id, status: 'PLANNED' },
            data: { status: 'SUPERSEDED' },
        });
        if (claimed.count === 0) return null;
        const created = await tx.plannedSession.create({
            data: { ...data, supersedesId: existing.id },
            select: { id: true },
        });
        return created.id;
    });
    if (!createdId) return { kind: 'locked', reason: 'This session changed meanwhile' };
    return { kind: 'saved', sessionId: createdId };
}

/** Done, skipped or reopened by hand; a manual done counts its planned load (story 65). */
export async function markSession(userId: string, sessionId: string, mark: SessionMark): Promise<SessionWriteOutcome> {
    const existing = await db.plannedSession.findUnique({ where: { id: sessionId } });
    if (!existing || existing.userId !== userId) return { kind: 'not-found' };
    if (existing.status === 'SUPERSEDED') return { kind: 'locked', reason: 'This session was replaced' };
    if (existing.activityId) return { kind: 'locked', reason: 'A synced activity already settled this session' };
    await db.plannedSession.update({ where: { id: existing.id }, data: { status: mark } });
    return { kind: 'saved', sessionId: existing.id };
}

/** A time trial's result becomes a race result, so the plan anchors from it (story 38). */
export async function recordTimeTrial(
    userId: string,
    sessionId: string,
    timeSec: unknown,
): Promise<SessionWriteOutcome> {
    if (typeof timeSec !== 'number' || !Number.isInteger(timeSec) || timeSec <= 0 || timeSec > MAX_TIME_TRIAL_SEC) {
        return { kind: 'invalid', errors: ['time must be a whole number of seconds, up to 6 hours'] };
    }
    const existing = await db.plannedSession.findUnique({
        where: { id: sessionId },
        include: { planWeek: { select: { timeTrialDistanceM: true } } },
    });
    if (!existing || existing.userId !== userId) return { kind: 'not-found' };
    const distanceM = existing.planWeek.timeTrialDistanceM;
    if (existing.kind !== 'RUNNING' || distanceM == null) {
        return { kind: 'locked', reason: 'This week has no time trial' };
    }
    if (existing.status !== 'PLANNED' || existing.activityId) {
        return { kind: 'locked', reason: 'This session is already settled' };
    }

    const recorded = await db.$transaction(async (tx) => {
        // Claiming the still-planned row first keeps it to one race result, even under a double submit.
        const claimed = await tx.plannedSession.updateMany({
            where: { id: existing.id, status: 'PLANNED', activityId: null },
            data: { status: 'DONE' },
        });
        if (claimed.count === 0) return false;
        await tx.raceResult.create({
            data: { userId, date: existing.scheduledDate, distanceM, timeSec, label: 'Time trial' },
        });
        return true;
    });
    if (!recorded) return { kind: 'locked', reason: 'This session is already settled' };
    return { kind: 'saved', sessionId: existing.id };
}

/** The session a Garmin upload builds from; superseded rows never go to the watch. */
export async function getUploadableSession(userId: string, sessionId: string) {
    const session = await db.plannedSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId || session.status === 'SUPERSEDED') return null;
    // Stored JSON is read back untyped; a body missing its list is not a session the adapter can build.
    const body = session.body as Record<string, unknown> | null;
    if (session.kind === 'RUNNING' && !Array.isArray(body?.steps)) return null;
    if (session.kind === 'STRENGTH' && !Array.isArray(body?.exercises)) return null;
    return { kind: session.kind, body } as unknown as GarminSource;
}

/** One HTTP shape for every session write, so the four routes answer alike. */
export function sessionResponse(
    outcome: SessionWriteOutcome,
    created = false,
): { status: number; body: Record<string, unknown> } {
    switch (outcome.kind) {
        case 'not-found':
            return { status: 404, body: { code: 'NOT_FOUND', message: 'Session not found' } };
        case 'invalid':
            return { status: 400, body: { code: 'INVALID_SESSION', message: outcome.errors.join('; ') } };
        case 'outside-plan':
            return { status: 400, body: { code: 'OUTSIDE_PLAN', message: 'The date is outside your plan' } };
        case 'locked':
            return { status: 409, body: { code: 'LOCKED', message: outcome.reason } };
        case 'saved':
            return { status: created ? 201 : 200, body: { data: { sessionId: outcome.sessionId } } };
    }
}
