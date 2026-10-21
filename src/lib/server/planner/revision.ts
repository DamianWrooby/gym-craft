// Revisions (ADRs 0015, 0016): an event re-evaluates the current plan week; a revision rewrites its
// remaining sessions through an AI request, superseding the old rows. Capped per month, counted
// once at DONE; a FAILED request is free and may be retried twice.
import { db } from '$lib/database';
import { addDays, currentMonthStartIso, dateInTimezone, toIsoDate, todayInTimezone } from '$lib/utils/iso-week';
import { getLimit, resolveAiModel } from '@/constants/subscription.constants';
import { resolveTier } from '$lib/server/subscription/tier';
import { getSchool, isSchoolId } from '$lib/planner/schools/catalogue';
import { reevaluate, type RevisionReason, type RevisionTrigger } from '$lib/planner/core/revision';
import { canDowngrade, resolveConflict } from '$lib/planner/core/conflict';
import { fixturesBetween, toFixtureGoal } from '$lib/planner/core/fixtures';
import type { AvailabilityMap } from '$lib/planner/wizard';
import type { Prisma } from '@prisma/client';
import { MAX_RETRIES, readWeekOutput } from './week-generation';
import { buildWeekPrompt, type AiRequestInput, type PromptSession } from './week-prompt';

/** Well past the proxy's 150 s OpenAI timeout: a RUNNING row this old lost its proxy call. */
const STALE_RUNNING_MS = 5 * 60 * 1000;

/** What started a re-evaluation, for the "what changed" view (ADR 0015). */
export interface RevisionCause {
    trigger: RevisionTrigger;
    activityIds?: string[];
    plannedSessionId?: string;
}

/** The stored verdict: the numbers, plus what the app did with them. */
export interface StoredRevisionReason extends RevisionReason {
    outcome: 'revise' | 'ask' | 'capped';
    scope: string[];
    /** The first day the revision rewrites. */
    from: string;
}

export type ReevaluationOutcome =
    | { kind: 'no-week' }
    | { kind: 'in-flight' }
    | { kind: 'no-change' }
    | { kind: 'ask' }
    | { kind: 'capped'; used: number; cap: number }
    | { kind: 'requested'; weekId: string; aiRequestId: string };

export type RevisionFinalizeOutcome =
    | { kind: 'not-found' }
    | { kind: 'generated' }
    | { kind: 'pending'; requestStatus: string }
    | { kind: 'failed'; retriesLeft: number };

export type RevisionRetryOutcome =
    | { kind: 'not-found' }
    | { kind: 'not-failed' }
    | { kind: 'limit' }
    | { kind: 'retrying'; aiRequestId: string; retriesLeft: number };

const retriesLeft = (retryCount: number) => Math.max(0, MAX_RETRIES - retryCount);
const round1 = (n: number) => Math.round(n * 10) / 10;
const asDate = (yyyymmdd: string) => new Date(`${yyyymmdd}T00:00:00Z`);
const titleOf = (body: unknown) => (body as { title?: string } | null)?.title ?? 'Session';
const keySessionOf = (kind: string, body: unknown) =>
    kind === 'RUNNING' ? ((body as { keySession?: string | null } | null)?.keySession ?? null) : null;

/** Tier and model from the stored subscription, so the sync path needs no request locals. */
async function aiAccount(userId: string) {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { subscriptionStatus: true, currentPeriodEnd: true, aiModelPreference: true },
    });
    const tier = resolveTier({
        subscriptionStatus: user?.subscriptionStatus ?? null,
        currentPeriodEnd: user?.currentPeriodEnd ?? null,
    });
    return { tier, model: resolveAiModel(tier, user?.aiModelPreference) };
}

/** Revisions spent this month: only those that reached DONE (ADR 0016). */
export async function revisionsUsed(userId: string): Promise<number> {
    const usage = await db.aiUsage.findUnique({
        where: { userId_kind_day: { userId, kind: 'plan_revision', day: currentMonthStartIso() } },
        select: { count: true },
    });
    return usage?.count ?? 0;
}

async function currentWeek(userId: string, today: string) {
    const plan = await db.plan.findFirst({
        where: { userId, state: 'ACTIVE' },
        include: {
            phases: {
                include: {
                    weeks: {
                        where: { startDate: { lte: asDate(today) }, endDate: { gte: asDate(today) } },
                        include: {
                            aiRequest: { select: { input: true } },
                            revisionRequest: { select: { status: true, updatedAt: true } },
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
    if (!plan) return null;
    for (const phase of plan.phases) {
        const week = phase.weeks[0];
        if (week) return { plan, phase, week };
    }
    return null;
}

/** Loads of linked activities, and the load of activities in the week linked to no session. */
async function executedLoads(userId: string, week: { startDate: Date; endDate: Date }, timezone: string) {
    const startDate = toIsoDate(week.startDate);
    const endDate = toIsoDate(week.endDate);
    // A day either side covers every timezone; the local date then decides the week.
    const activities = await db.activity.findMany({
        where: {
            userId,
            startTime: { gte: asDate(addDays(startDate, -1)), lt: asDate(addDays(endDate, 2)) },
        },
        select: { id: true, startTime: true, trimpLoad: true },
    });
    const inWeek = activities.filter((a) => {
        const date = dateInTimezone(a.startTime, timezone);
        return date >= startDate && date <= endDate;
    });
    const links = await db.plannedSession.findMany({
        where: { userId, activityId: { in: inWeek.map((a) => a.id) } },
        select: { activityId: true },
    });
    const linked = new Set(links.map((l) => l.activityId));
    const loadOf = new Map(inWeek.map((a) => [a.id, a.trimpLoad]));
    const unscheduledLoad = round1(inWeek.filter((a) => !linked.has(a.id)).reduce((t, a) => t + (a.trimpLoad ?? 0), 0));
    return { loadOf, unscheduledLoad };
}

function describeReason(r: RevisionReason, trigger: RevisionTrigger): string {
    if (trigger === 'ATHLETE') return 'the athlete asked for the rest of the week to be rewritten.';
    if (trigger === 'CHECK_IN') return 'the athlete reported poor days this week.';
    const parts: string[] = [];
    if (r.overspend > 0) {
        parts.push(
            `done ${r.executedLoad} plus planned ${r.remainingLoad} exceeds the recovery budget ${r.budget} by ${r.overspend}`,
        );
    }
    if (r.missedKeySessions.length) parts.push(`missed key sessions: ${r.missedKeySessions.join(', ')}`);
    return `${parts.join('; ')}.`;
}

/**
 * Re-evaluates the current plan week (ADR 0015). At most one revision is in flight per week. At the
 * cap the verdict is stored and shown, but no AI rewrite happens.
 */
export async function reevaluateCurrentWeek(
    userId: string,
    trigger: RevisionTrigger,
    cause: Omit<RevisionCause, 'trigger'> = {},
): Promise<ReevaluationOutcome> {
    const profile = await db.athleteProfile.findUnique({ where: { userId }, select: { timezone: true } });
    const timezone = profile?.timezone ?? 'UTC';
    const today = todayInTimezone(timezone);
    const found = await currentWeek(userId, today);
    if (!found || found.week.generation !== 'GENERATED') return { kind: 'no-week' };
    const { plan, phase, week } = found;

    const running = week.revisionRequest;
    const stale = running?.status === 'RUNNING' && Date.now() - running.updatedAt.getTime() > STALE_RUNNING_MS;
    if (week.revisionGeneration === 'PENDING' && !stale) return { kind: 'in-flight' };

    const { loadOf, unscheduledLoad } = await executedLoads(userId, week, timezone);
    const sessions = week.sessions.map((s) => ({
        id: s.id,
        origin: s.origin,
        status: s.status,
        scheduledDate: toIsoDate(s.scheduledDate),
        plannedLoad: s.plannedLoad,
        actualLoad: s.activityId ? (loadOf.get(s.activityId) ?? null) : null,
        keySession: keySessionOf(s.kind, s.body),
        title: titleOf(s.body),
    }));
    const verdict = reevaluate({
        today,
        budget: week.recoveryBudget,
        sessions,
        unscheduledLoad,
        trigger,
        lastRevisedOn: week.revisedAt ? dateInTimezone(week.revisedAt, timezone) : null,
    });
    if (verdict.kind === 'no-change') return { kind: 'no-change' };

    const storedCause = { trigger, ...cause } as unknown as Prisma.InputJsonValue;
    const stored = (outcome: StoredRevisionReason['outcome']) =>
        ({ ...verdict.reason, outcome, scope: verdict.scope, from: today }) as unknown as Prisma.InputJsonValue;

    if (verdict.kind === 'ask') {
        await db.planWeek.update({
            where: { id: week.id },
            data: { revisionCause: storedCause, revisionReason: stored('ask') },
        });
        return { kind: 'ask' };
    }

    const { tier, model } = await aiAccount(userId);
    const cap = getLimit(tier, 'planRevisionsPerMonth');
    const used = await revisionsUsed(userId);
    if (used >= cap) {
        await db.planWeek.update({
            where: { id: week.id },
            data: { revisionCause: storedCause, revisionReason: stored('capped') },
        });
        return { kind: 'capped', used, cap };
    }

    if (!isSchoolId(phase.school)) throw new Error(`Unknown school on phase: ${phase.school}`);
    const inScope = new Set(verdict.scope);
    const line = (s: (typeof sessions)[number]): PromptSession => ({
        date: s.scheduledDate,
        title: s.title,
        load: round1(s.actualLoad ?? s.plannedLoad),
    });
    const fixed = sessions.filter((s) => s.status === 'PLANNED' && s.scheduledDate >= today && !inScope.has(s.id));
    const fixedLoad = fixed.reduce((t, s) => t + s.plannedLoad, 0);
    const startDate = toIsoDate(week.startDate);
    const planEnd = toIsoDate(plan.endDate);
    const weekEnd = addDays(startDate, 6);
    const to = planEnd < weekEnd ? planEnd : weekEnd;
    const goals = await db.runningGoal.findMany({ where: { userId, archivedAt: null } });
    const anchor = (week.aiRequest?.input as Partial<AiRequestInput> | null)?.anchor ?? null;

    const prompt = buildWeekPrompt({
        school: getSchool(phase.school),
        phase,
        week: { ...week, startDate, from: today, to },
        availability: plan.availability as unknown as AvailabilityMap,
        longRunDay: plan.longRunDay,
        anchor,
        fixtures: fixturesBetween(goals.map(toFixtureGoal), plan.goalId, today, to),
        revision: {
            done: sessions.filter((s) => s.status === 'DONE').map(line),
            unscheduledLoad,
            fixed: fixed.map(line),
            loadLeft:
                week.recoveryBudget == null
                    ? null
                    : Math.max(0, round1(week.recoveryBudget - verdict.reason.executedLoad - fixedLoad)),
            why: describeReason(verdict.reason, trigger),
            unwell: trigger === 'CHECK_IN',
        },
    });

    const aiRequestId = await db.$transaction(async (tx) => {
        const request = await tx.aiRequest.create({
            data: { userId, model, input: prompt as unknown as Prisma.InputJsonValue },
            select: { id: true },
        });
        // Claiming only a week with no revision in flight keeps it to one, even under a race.
        const claimed = await tx.planWeek.updateMany({
            // A stale in-flight revision may be replaced; `not` alone would skip the null column.
            where: stale
                ? { id: week.id }
                : { id: week.id, OR: [{ revisionGeneration: null }, { revisionGeneration: { not: 'PENDING' } }] },
            data: {
                revisionRequestId: request.id,
                revisionGeneration: 'PENDING',
                revisionCause: storedCause,
                revisionReason: stored('revise'),
            },
        });
        if (claimed.count === 0) {
            await tx.aiRequest.delete({ where: { id: request.id } });
            return null;
        }
        return request.id;
    });
    if (!aiRequestId) return { kind: 'in-flight' };
    return { kind: 'requested', weekId: week.id, aiRequestId };
}

async function loadRevisedWeek(userId: string, weekId: string) {
    const week = await db.planWeek.findUnique({
        where: { id: weekId },
        include: {
            revisionRequest: true,
            phase: { include: { plan: true } },
            sessions: { where: { status: { not: 'SUPERSEDED' } } },
        },
    });
    return week && week.userId === userId ? week : null;
}

type RevisedWeek = NonNullable<Awaited<ReturnType<typeof loadRevisedWeek>>>;

async function failRevision(week: RevisedWeek, requestId: string, error: string | null): Promise<void> {
    await db.$transaction(async (tx) => {
        if (error != null) await tx.aiRequest.update({ where: { id: requestId }, data: { status: 'FAILED', error } });
        await tx.planWeek.update({ where: { id: week.id }, data: { revisionGeneration: 'FAILED' } });
    });
}

/**
 * Stores a finished revision: the scope's still-planned sessions become SUPERSEDED and the new rows
 * point at them. Idempotent. Counts one `plan_revision` only here, at DONE; a failure is free.
 */
export async function finalizeRevision(userId: string, weekId: string): Promise<RevisionFinalizeOutcome> {
    const week = await loadRevisedWeek(userId, weekId);
    if (!week) return { kind: 'not-found' };
    if (week.revisionGeneration === 'GENERATED') return { kind: 'generated' };
    const request = week.revisionRequest;
    if (!request) return { kind: 'pending', requestStatus: 'NONE' };
    if (request.status === 'RUNNING' && Date.now() - request.updatedAt.getTime() > STALE_RUNNING_MS) {
        await failRevision(week, request.id, 'Stalled: the proxy never wrote a result');
        return { kind: 'failed', retriesLeft: retriesLeft(request.retryCount) };
    }
    if (request.status === 'FAILED') {
        if (week.revisionGeneration !== 'FAILED') await failRevision(week, request.id, null);
        return { kind: 'failed', retriesLeft: retriesLeft(request.retryCount) };
    }
    if (request.status !== 'DONE') return { kind: 'pending', requestStatus: request.status };

    const reason = week.revisionReason as unknown as StoredRevisionReason;
    const read = await readWeekOutput(userId, week, request, reason.from);
    if (!read.ok) {
        await failRevision(week, request.id, read.errors.join('; ').slice(0, 1000));
        return { kind: 'failed', retriesLeft: retriesLeft(request.retryCount) };
    }
    const { school, anchor, written, costs } = read;

    // The week's budget is read, never re-struck (ADR 0015): only easy volume is trimmed silently.
    const scope = new Set(reason.scope);
    const fixedLoad = week.sessions
        .filter((s) => s.status === 'PLANNED' && !scope.has(s.id) && toIsoDate(s.scheduledDate) >= reason.from)
        .reduce((t, s) => t + s.plannedLoad, 0);
    const loadLeft =
        week.recoveryBudget == null ? null : Math.max(0, round1(week.recoveryBudget - reason.executedLoad - fixedLoad));
    const resolution = resolveConflict(
        written.map((s, i) => ({
            title: s.body.title,
            kind: s.kind,
            plannedLoad: costs[i].plannedLoad,
            method: costs[i].method,
            keySession: s.kind === 'RUNNING' ? s.body.keySession : null,
            cutKey: s.kind === 'RUNNING' ? s.body.cutKey : null,
            canDowngrade: s.kind === 'RUNNING' && canDowngrade(s.body.steps, school),
        })),
        loadLeft,
        school,
    );
    const kept = written.map((_, i) => i).filter((i) => resolution.kind !== 'trim' || !resolution.removed.includes(i));

    // Sessions the revision keeps sit first on their day; the new ones follow.
    const replaced = week.sessions
        .filter((s) => scope.has(s.id) && s.status === 'PLANNED')
        .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime() || a.sequence - b.sequence);
    const occupied = new Map<string, number>();
    for (const s of week.sessions) {
        if (scope.has(s.id)) continue;
        const day = toIsoDate(s.scheduledDate);
        occupied.set(day, (occupied.get(day) ?? 0) + 1);
    }
    const anchorRecord = anchor
        ? { provenance: anchor.provenance, sourceId: anchor.sourceId, date: anchor.date, stale: anchor.stale }
        : null;
    const monthKey = currentMonthStartIso();

    await db.$transaction(async (tx) => {
        // The conditional update is the idempotency guard: a second finalize finds nothing to claim.
        const claimed = await tx.planWeek.updateMany({
            where: { id: week.id, revisionRequestId: request.id, revisionGeneration: { not: 'GENERATED' } },
            data: { revisionGeneration: 'GENERATED', revision: { increment: 1 }, revisedAt: new Date() },
        });
        if (claimed.count === 0) return;

        await tx.plannedSession.updateMany({
            where: { id: { in: replaced.map((s) => s.id) }, status: 'PLANNED' },
            data: { status: 'SUPERSEDED' },
        });
        await tx.plannedSession.createMany({
            data: kept.map((i, n) => {
                const s = written[i];
                const cost = costs[i];
                return {
                    userId,
                    planWeekId: week.id,
                    kind: s.kind,
                    scheduledDate: asDate(s.scheduledDate),
                    sequence: (occupied.get(s.scheduledDate) ?? 0) + s.sequence,
                    origin: 'AI' as const,
                    plannedLoad: cost.plannedLoad,
                    loadMethod: cost.method,
                    supersedesId: replaced[n]?.id ?? null,
                    anchor: s.kind === 'RUNNING' && anchorRecord ? anchorRecord : undefined,
                    body: s.body as unknown as Prisma.InputJsonValue,
                    bodyVersion: s.body.bodyVersion,
                };
            }),
        });
        // Counted once, here at DONE: the revision cap reads this (ADR 0016).
        await tx.aiUsage.upsert({
            where: { userId_kind_day: { userId, kind: 'plan_revision', day: monthKey } },
            create: { userId, kind: 'plan_revision', day: monthKey, count: 1 },
            update: { count: { increment: 1 } },
        });
    });
    return { kind: 'generated' };
}

export async function retryRevision(userId: string, weekId: string): Promise<RevisionRetryOutcome> {
    const week = await loadRevisedWeek(userId, weekId);
    if (!week) return { kind: 'not-found' };
    const request = week.revisionRequest;
    if (week.revisionGeneration !== 'FAILED' || !request || request.status !== 'FAILED') return { kind: 'not-failed' };
    if (request.retryCount >= MAX_RETRIES) return { kind: 'limit' };

    const retryCount = request.retryCount + 1;
    await db.$transaction(async (tx) => {
        await tx.aiRequest.update({
            where: { id: request.id },
            data: { status: 'PENDING', output: null, error: null, retryCount },
        });
        await tx.planWeek.update({ where: { id: week.id }, data: { revisionGeneration: 'PENDING' } });
    });
    return { kind: 'retrying', aiRequestId: request.id, retriesLeft: retriesLeft(retryCount) };
}
