// Revisions (ADRs 0015, 0016): an event re-evaluates the current plan week; a revision rewrites its
// remaining sessions through an AI request, superseding the old rows. Capped per month, counted
// once at DONE; a FAILED request is free and may be retried twice.
import { db } from '$lib/database';
import {
    addDays,
    currentMonthStartIso,
    dateInTimezone,
    toIsoDate,
    todayInTimezone,
    fromIsoDate,
} from '$lib/utils/iso-week';
import { getLimit, resolveAiModel, type SubscriptionTier } from '@/constants/subscription.constants';
import { resolveTier } from '$lib/server/subscription/tier';
import { getSchool, isSchoolId } from '$lib/planner/schools/catalogue';
import { reevaluate, type Reevaluation, type RevisionReason, type RevisionTrigger } from '$lib/planner/core/revision';
import {
    athleteSessionsAsk,
    canDowngrade,
    resolveConflict,
    type ConflictRecord,
    type Resolution,
    type SessionRef,
} from '$lib/planner/core/conflict';
import { fixturesBetween, toFixtureGoal } from '$lib/planner/core/fixtures';
import type { Prisma } from '@prisma/client';
import { MAX_RETRIES, readWeekOutput, retriesLeft, type WeekOutput } from './week-generation';
import { buildWeekPrompt, type AiRequestInput, type PromptSession } from './week-prompt';
import { athleteTimezone, weekOn } from './current-week';
import {
    keySessionOf,
    plannedMethodOf,
    readAnchor,
    readConflict,
    readRevisionScope,
    readRunningBody,
    titleOf,
    toJson,
    type RevisionCause,
    type RevisionScope,
    type StoredRevisionReason,
    readAvailability,
} from './stored';

/** Well past the proxy's 150 s OpenAI timeout: a RUNNING row this old lost its proxy call. */
const STALE_RUNNING_MS = 5 * 60 * 1000;

/** What a revision request rewrites, stored on the request itself: a later verdict may overwrite the
 * week's reason while a failed request still waits for a retry. */
interface RevisionRequestInput extends AiRequestInput {
    revisionScope: RevisionScope;
}

/** The budget a revision may still spend: never re-struck, only read (ADR 0015). */
const loadLeftOf = (budget: number | null, executedLoad: number, fixedLoad: number) =>
    budget == null ? null : Math.max(0, round1(budget - executedLoad - fixedLoad));

/** Tier and model; the request routes pass the session's, the sync path reads them from the DB. */
export interface AiAccount {
    tier: SubscriptionTier;
    model: string;
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

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Tier and model from the stored subscription, so the sync path needs no request locals. */
async function aiAccount(userId: string): Promise<AiAccount> {
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
                        where: { startDate: { lte: fromIsoDate(today) }, endDate: { gte: fromIsoDate(today) } },
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
    const found = plan && weekOn(plan.phases, today);
    return found ? { plan, ...found } : null;
}

type CurrentWeek = NonNullable<Awaited<ReturnType<typeof currentWeek>>>;

/** Loads of linked activities, and the load of activities in the week linked to no session. */
async function executedLoads(userId: string, week: { startDate: Date; endDate: Date }, timezone: string) {
    const startDate = toIsoDate(week.startDate);
    const endDate = toIsoDate(week.endDate);
    // A day either side covers every timezone; the local date then decides the week.
    const activities = await db.activity.findMany({
        where: {
            userId,
            startTime: { gte: fromIsoDate(addDays(startDate, -1)), lt: fromIsoDate(addDays(endDate, 2)) },
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

interface JudgedSession {
    id: string;
    status: string;
    scheduledDate: string;
    title: string;
    plannedLoad: number;
    actualLoad: number | null;
}

interface JudgedWeek {
    sessions: JudgedSession[];
    unscheduledLoad: number;
    verdict: Reevaluation;
}

/** The current week's sessions with their executed loads, and the verdict on them. */
async function judgeWeek(
    userId: string,
    week: CurrentWeek['week'],
    today: string,
    timezone: string,
    trigger: RevisionTrigger,
): Promise<JudgedWeek> {
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
    return { sessions, unscheduledLoad, verdict };
}

/** The revision prompt: what is done, what stays fixed, and the load left for the scope. */
async function buildRevisionInput(
    userId: string,
    { plan, phase, week }: CurrentWeek,
    { sessions, unscheduledLoad, verdict }: JudgedWeek,
    today: string,
    trigger: RevisionTrigger,
): Promise<RevisionRequestInput> {
    if (!isSchoolId(phase.school)) throw new Error(`Unknown school on phase: ${phase.school}`);
    const inScope = new Set(verdict.scope);
    const line = (s: JudgedSession): PromptSession => ({
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
    const anchor = readAnchor(week.aiRequest?.input);

    const prompt = buildWeekPrompt({
        school: getSchool(phase.school),
        phase,
        week: { ...week, startDate, from: today, to },
        availability: readAvailability(plan.availability),
        longRunDay: plan.longRunDay,
        anchor,
        fixtures: fixturesBetween(goals.map(toFixtureGoal), plan.goalId, today, to),
        revision: {
            done: sessions.filter((s) => s.status === 'DONE').map(line),
            unscheduledLoad,
            fixed: fixed.map(line),
            loadLeft: loadLeftOf(week.recoveryBudget, verdict.reason.executedLoad, fixedLoad),
            why: describeReason(verdict.reason, trigger),
            unwell: trigger === 'CHECK_IN',
        },
    });
    return {
        ...prompt,
        revisionScope: { scope: verdict.scope, from: today, executedLoad: verdict.reason.executedLoad },
    };
}

interface RevisionClaim {
    userId: string;
    weekId: string;
    /** A stale in-flight revision may be replaced. */
    replaceStale: boolean;
    model: string;
    input: RevisionRequestInput;
    cause: RevisionCause;
    reason: StoredRevisionReason;
}

/** Writes the request and claims the week for it; null when another revision got there first. */
function claimRevision(claim: RevisionClaim): Promise<string | null> {
    const { userId, weekId } = claim;
    return db.$transaction(async (tx) => {
        const request = await tx.aiRequest.create({
            data: { userId, model: claim.model, input: toJson(claim.input) },
            select: { id: true },
        });
        // Claiming only a week with no revision in flight keeps it to one, even under a race.
        const claimed = await tx.planWeek.updateMany({
            // `not` alone would skip the null column.
            where: claim.replaceStale
                ? { id: weekId }
                : { id: weekId, OR: [{ revisionGeneration: null }, { revisionGeneration: { not: 'PENDING' } }] },
            data: {
                revisionRequestId: request.id,
                revisionGeneration: 'PENDING',
                revisionCause: toJson(claim.cause),
                revisionReason: toJson(claim.reason),
            },
        });
        if (claimed.count === 0) {
            await tx.aiRequest.delete({ where: { id: request.id } });
            return null;
        }
        return request.id;
    });
}

/**
 * 0013's ask over the athlete's own remaining sessions, when the week is over budget; null otherwise.
 * A week kept over budget, or with a question still open, is not asked again.
 */
function athleteAsk({ phase, week }: CurrentWeek, today: string, reason: RevisionReason): ConflictRecord | null {
    if (week.recoveryBudget == null || reason.overspend <= 0) return null;
    if (week.decision === 'KEPT' || week.decision === 'PENDING') return null;
    if (!isSchoolId(phase.school)) return null;
    const school = getSchool(phase.school);
    const remaining = week.sessions.filter((s) => s.status === 'PLANNED' && toIsoDate(s.scheduledDate) >= today);
    if (remaining.length === 0) return null;
    const ask = athleteSessionsAsk(
        remaining.map((s) => {
            const running = readRunningBody(s.kind, s.body);
            return {
                title: titleOf(s.body),
                kind: s.kind,
                plannedLoad: s.plannedLoad,
                method: plannedMethodOf(s.loadMethod),
                keySession: keySessionOf(s.kind, s.body),
                cutKey: running?.cutKey ?? null,
                canDowngrade: running != null && canDowngrade(running.steps, school),
            };
        }),
        { executedLoad: reason.executedLoad, budget: week.recoveryBudget },
        school,
    );
    const ref = (i: number): SessionRef => ({
        scheduledDate: toIsoDate(remaining[i].scheduledDate),
        sequence: remaining[i].sequence,
    });
    return askRecordOf(ask, ref, readConflict(week.conflict)?.placement ?? null);
}

/**
 * Re-evaluates the current plan week (ADR 0015). At most one revision is in flight per week. At the
 * cap the verdict is stored and shown, but no AI rewrite happens.
 */
export async function reevaluateCurrentWeek(
    userId: string,
    trigger: RevisionTrigger,
    cause: Omit<RevisionCause, 'trigger'> = {},
    account?: AiAccount,
): Promise<ReevaluationOutcome> {
    const timezone = await athleteTimezone(userId);
    const today = todayInTimezone(timezone);
    const found = await currentWeek(userId, today);
    if (!found || found.week.generation !== 'GENERATED') return { kind: 'no-week' };
    const { week } = found;

    const running = week.revisionRequest;
    const stale = running?.status === 'RUNNING' && Date.now() - running.updatedAt.getTime() > STALE_RUNNING_MS;
    if (week.revisionGeneration === 'PENDING' && !stale) return { kind: 'in-flight' };

    const judged = await judgeWeek(userId, week, today, timezone, trigger);
    const { verdict } = judged;
    if (verdict.kind === 'no-change') return { kind: 'no-change' };

    const revisionCause: RevisionCause = { trigger, ...cause };
    const reasonFor = (outcome: StoredRevisionReason['outcome']): StoredRevisionReason => ({
        ...verdict.reason,
        outcome,
        scope: verdict.scope,
        from: today,
    });
    const storeVerdict = (outcome: 'ask' | 'capped', extra: Prisma.PlanWeekUpdateInput = {}) =>
        db.planWeek.update({
            where: { id: week.id },
            data: { revisionCause: toJson(revisionCause), revisionReason: toJson(reasonFor(outcome)), ...extra },
        });

    if (verdict.kind === 'ask') {
        const conflict = athleteAsk(found, today, verdict.reason);
        await storeVerdict('ask', conflict ? { conflict: toJson(conflict), decision: 'PENDING' } : {});
        return { kind: 'ask' };
    }

    const { tier, model } = account ?? (await aiAccount(userId));
    const cap = getLimit(tier, 'planRevisionsPerMonth');
    const used = await revisionsUsed(userId);
    if (used >= cap) {
        await storeVerdict('capped');
        return { kind: 'capped', used, cap };
    }

    const aiRequestId = await claimRevision({
        userId,
        weekId: week.id,
        replaceStale: stale,
        model,
        input: await buildRevisionInput(userId, found, judged, today, trigger),
        cause: revisionCause,
        reason: reasonFor('revise'),
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

type WrittenWeek = Extract<WeekOutput, { ok: true }>;

/**
 * The week's budget is read, never re-struck (ADR 0015). Easy volume is trimmed silently; when a
 * key session would have to go, the week is stored as written and 0013's ask decides.
 */
function resolveBudget(week: RevisedWeek, target: RevisionScope, { school, written, costs }: WrittenWeek): Resolution {
    const scope = new Set(target.scope);
    const fixedLoad = week.sessions
        .filter((s) => s.status === 'PLANNED' && !scope.has(s.id) && toIsoDate(s.scheduledDate) >= target.from)
        .reduce((t, s) => t + s.plannedLoad, 0);
    return resolveConflict(
        written.map((s, i) => ({
            title: s.body.title,
            kind: s.kind,
            plannedLoad: costs[i].plannedLoad,
            method: costs[i].method,
            keySession: s.kind === 'RUNNING' ? s.body.keySession : null,
            cutKey: s.kind === 'RUNNING' ? s.body.cutKey : null,
            canDowngrade: s.kind === 'RUNNING' && canDowngrade(s.body.steps, school),
        })),
        loadLeftOf(week.recoveryBudget, target.executedLoad, fixedLoad),
        school,
    );
}

/** Where the kept rows go: which old row each supersedes, and its sequence on the day. */
function placeRevision(week: RevisedWeek, target: RevisionScope, written: WrittenWeek['written'], kept: number[]) {
    const scope = new Set(target.scope);
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
    // Each replacement points at a replaced session on its own day; extra rows on a day point at none.
    const unpaired = [...replaced];
    const supersedes = kept.map((i) => {
        const at = unpaired.findIndex((s) => toIsoDate(s.scheduledDate) === written[i].scheduledDate);
        return at < 0 ? null : unpaired.splice(at, 1)[0].id;
    });
    const sequenceOf = (i: number) => (occupied.get(written[i].scheduledDate) ?? 0) + written[i].sequence;
    return { replaced: replaced.map((s) => s.id), supersedes, sequenceOf };
}

function askRecordOf(
    resolution: Resolution,
    ref: (i: number) => SessionRef,
    placement: ConflictRecord['placement'] = null,
): ConflictRecord | null {
    if (resolution.kind !== 'ask') return null;
    return {
        placement,
        budget: {
            kind: 'ASK',
            facts: resolution.facts,
            schoolFit: resolution.schoolFit,
            removed: resolution.removed.map(ref),
            keySession: ref(resolution.keySessionIndex),
        },
    };
}

interface StoredRevision {
    userId: string;
    weekId: string;
    requestId: string;
    replaced: string[];
    rows: Prisma.PlannedSessionCreateManyInput[];
    ask: ConflictRecord | null;
}

/** One transaction: claim the week, supersede, insert, and count the revision. */
async function storeRevision({ userId, weekId, requestId, replaced, rows, ask }: StoredRevision): Promise<void> {
    const monthKey = currentMonthStartIso();
    await db.$transaction(async (tx) => {
        // The conditional update is the idempotency guard: a second finalize finds nothing to claim.
        const claimed = await tx.planWeek.updateMany({
            where: { id: weekId, revisionRequestId: requestId, revisionGeneration: { not: 'GENERATED' } },
            data: {
                revisionGeneration: 'GENERATED',
                revision: { increment: 1 },
                revisedAt: new Date(),
                ...(ask && { conflict: toJson(ask), decision: 'PENDING' as const }),
            },
        });
        if (claimed.count === 0) return;

        await tx.plannedSession.updateMany({
            where: { id: { in: replaced }, status: 'PLANNED' },
            data: { status: 'SUPERSEDED' },
        });
        await tx.plannedSession.createMany({ data: rows });
        // Counted once, here at DONE: the revision cap reads this (ADR 0016).
        await tx.aiUsage.upsert({
            where: { userId_kind_day: { userId, kind: 'plan_revision', day: monthKey } },
            create: { userId, kind: 'plan_revision', day: monthKey, count: 1 },
            update: { count: { increment: 1 } },
        });
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
    const failed = async (error: string | null) => {
        await failRevision(week, request.id, error);
        return { kind: 'failed' as const, retriesLeft: retriesLeft(request.retryCount) };
    };
    if (request.status === 'RUNNING' && Date.now() - request.updatedAt.getTime() > STALE_RUNNING_MS) {
        return failed('Stalled: the proxy never wrote a result');
    }
    if (request.status === 'FAILED') {
        if (week.revisionGeneration === 'FAILED')
            return { kind: 'failed', retriesLeft: retriesLeft(request.retryCount) };
        return failed(null);
    }
    if (request.status !== 'DONE') return { kind: 'pending', requestStatus: request.status };

    const target = readRevisionScope(request.input);
    if (!target) return failed('The request has no revision scope');
    const read = await readWeekOutput(userId, week, request, target.from);
    if (!read.ok) return failed(read.errors.join('; ').slice(0, 1000));

    const { anchor, written, costs } = read;
    const resolution = resolveBudget(week, target, read);
    const kept = written.map((_, i) => i).filter((i) => resolution.kind !== 'trim' || !resolution.removed.includes(i));
    const { replaced, supersedes, sequenceOf } = placeRevision(week, target, written, kept);
    const ask = askRecordOf(resolution, (i) => ({ scheduledDate: written[i].scheduledDate, sequence: sequenceOf(i) }));
    const anchorRecord = anchor
        ? { provenance: anchor.provenance, sourceId: anchor.sourceId, date: anchor.date, stale: anchor.stale }
        : null;

    await storeRevision({
        userId,
        weekId: week.id,
        requestId: request.id,
        replaced,
        ask,
        rows: kept.map((i, n) => {
            const s = written[i];
            return {
                userId,
                planWeekId: week.id,
                kind: s.kind,
                scheduledDate: fromIsoDate(s.scheduledDate),
                sequence: sequenceOf(i),
                origin: 'AI' as const,
                plannedLoad: costs[i].plannedLoad,
                loadMethod: costs[i].method,
                supersedesId: supersedes[n],
                anchor: s.kind === 'RUNNING' && anchorRecord ? anchorRecord : undefined,
                body: toJson(s.body),
                bodyVersion: s.body.bodyVersion,
            };
        }),
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
    const reopened = await db.$transaction(async (tx) => {
        // Claiming the row at the retry count read keeps two parallel retries to one.
        const claimed = await tx.aiRequest.updateMany({
            where: { id: request.id, status: 'FAILED', retryCount: request.retryCount },
            data: { status: 'PENDING', output: null, error: null, retryCount },
        });
        if (claimed.count === 0) return false;
        await tx.planWeek.update({ where: { id: week.id }, data: { revisionGeneration: 'PENDING' } });
        return true;
    });
    if (!reopened) return { kind: 'not-failed' };
    return { kind: 'retrying', aiRequestId: request.id, retriesLeft: retriesLeft(retryCount) };
}
