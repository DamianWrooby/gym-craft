// Finalize and retry a plan week's AI request (ADR 0014). The proxy wrote the raw output to the
// row; here the server validates, costs and stores it. Safe to call any number of times.
import { db } from '$lib/database';
import { getAthleteProfile } from '$lib/prisma/prisma';
import { addDays, currentMonthStartIso, toIsoDate } from '$lib/utils/iso-week';
import { getSchool, isSchoolId } from '$lib/planner/schools/catalogue';
import { validateGeneration, type PlacementTrim } from '$lib/planner/core/generation';
import { costSession, type Cost } from '$lib/planner/core/cost';
import { canDowngrade, resolveConflict, type ConflictRecord, type SessionRef } from '$lib/planner/core/conflict';
import { attachTargets, labelPaces } from '$lib/planner/core/targets';
import { isValidZones } from '$lib/planner/core/zones';
import type { Prisma, WeekDecision } from '@prisma/client';
import type { TypedSession } from '$lib/planner/core/session';
import type { AiRequestInput } from './week-prompt';
import { readAvailability } from './stored';
import type { SchoolDefinition } from '$lib/planner/schools/types';
import type { Anchor } from '$lib/planner/core/anchor';

/** A failed request may be retried at most this many times (ADR 0016). */
export const MAX_RETRIES = 2;

/**
 * Well past the proxy's 150 s OpenAI timeout. A RUNNING row this old lost its proxy call; a PENDING
 * row this old never got one, because the tab closed first (#423).
 */
const STALE_MS = 5 * 60 * 1000;

/** Why a request no proxy call will finish is failed, or null while one still may. */
export function staleReason(request: { status: string; updatedAt: Date }): string | null {
    if (Date.now() - request.updatedAt.getTime() <= STALE_MS) return null;
    if (request.status === 'RUNNING') return 'Stalled: the proxy never wrote a result';
    if (request.status === 'PENDING') return 'Stalled: the proxy call never started';
    return null;
}

export type FinalizeOutcome =
    | { kind: 'not-found' }
    | { kind: 'generated' }
    | { kind: 'pending'; requestStatus: string }
    | { kind: 'failed'; retriesLeft: number };

export type RetryOutcome =
    | { kind: 'not-found' }
    | { kind: 'not-failed' }
    | { kind: 'limit' }
    | { kind: 'retrying'; aiRequestId: string; retriesLeft: number };

export const retriesLeft = (retryCount: number) => Math.max(0, MAX_RETRIES - retryCount);

async function loadWeek(userId: string, weekId: string) {
    const week = await db.planWeek.findUnique({
        where: { id: weekId },
        include: { aiRequest: true, phase: { include: { plan: true } } },
    });
    return week && week.userId === userId ? week : null;
}

type LoadedWeek = NonNullable<Awaited<ReturnType<typeof loadWeek>>>;

async function failWeek(week: LoadedWeek, requestId: string, error: string | null): Promise<void> {
    await db.$transaction(async (tx) => {
        if (error != null) await tx.aiRequest.update({ where: { id: requestId }, data: { status: 'FAILED', error } });
        await tx.planWeek.update({ where: { id: week.id }, data: { generation: 'FAILED' } });
    });
}

/** What a week's AI request wrote, validated, targeted and costed; nothing is stored here. */
export type WeekOutput =
    | { ok: false; errors: string[] }
    | {
          ok: true;
          school: SchoolDefinition;
          anchor: Anchor | null;
          written: TypedSession[];
          costs: Cost[];
          placementTrim: PlacementTrim | null;
      };

/**
 * Validates a finished request's output for the days from `from` to the week's end (inside the
 * horizon), then attaches targets and costs each session. Shared by pulls and revisions.
 */
export async function readWeekOutput(
    userId: string,
    week: {
        startDate: Date;
        phase: { school: string; plan: { startDate: Date; endDate: Date; availability: unknown; longRunDay: number } };
    },
    request: { input: unknown; output: string | null },
    from: string,
): Promise<WeekOutput> {
    const { plan } = week.phase;
    const profile = await getAthleteProfile(userId);
    if (!isSchoolId(week.phase.school)) throw new Error(`Unknown school on phase: ${week.phase.school}`);
    const school = getSchool(week.phase.school);

    const anchor = (request.input as Partial<AiRequestInput> | null)?.anchor ?? null;
    const paces = labelPaces(school, anchor);
    const weekStart = toIsoDate(week.startDate);
    const planStart = toIsoDate(plan.startDate);
    const planEnd = toIsoDate(plan.endDate);
    const weekEnd = addDays(weekStart, 6);
    const first = planStart > from ? planStart : from;

    const result = validateGeneration(request.output ?? '', {
        school,
        paceSecPerKm: paces,
        placement: {
            weekStart,
            from: first,
            to: planEnd < weekEnd ? planEnd : weekEnd,
            availability: readAvailability(plan.availability),
            longRunDay: plan.longRunDay,
            keySessions: school.keySessions.map((k) => k.key),
        },
    });
    if (!result.ok) return { ok: false, errors: result.errors };

    const zones = isValidZones(profile?.hrZoneBounds) ? profile.hrZoneBounds : null;
    const written = attachTargets(result.sessions, { school, anchor, zones });
    const costs = written.map((s) => costSession(s, { school, paceSecPerKm: paces }));
    return { ok: true, school, anchor, written, costs, placementTrim: result.placementTrim };
}

export async function finalizeWeek(userId: string, weekId: string): Promise<FinalizeOutcome> {
    const week = await loadWeek(userId, weekId);
    if (!week) return { kind: 'not-found' };
    if (week.generation === 'GENERATED') return { kind: 'generated' };

    const request = week.aiRequest;
    if (!request) return { kind: 'pending', requestStatus: 'NONE' };
    const stalled = staleReason(request);
    if (stalled) {
        await failWeek(week, request.id, stalled);
        return { kind: 'failed', retriesLeft: retriesLeft(request.retryCount) };
    }
    if (request.status === 'FAILED') {
        if (week.generation !== 'FAILED') await failWeek(week, request.id, null);
        return { kind: 'failed', retriesLeft: retriesLeft(request.retryCount) };
    }
    if (request.status !== 'DONE') return { kind: 'pending', requestStatus: request.status };

    const read = await readWeekOutput(userId, week, request, toIsoDate(week.startDate));
    if (!read.ok) {
        await failWeek(week, request.id, read.errors.join('; ').slice(0, 1000));
        return { kind: 'failed', retriesLeft: retriesLeft(request.retryCount) };
    }
    const { school, anchor, written, costs, placementTrim } = read;

    // School versus budget (ADR 0013): trim easy volume silently, or store as written and ask.
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
        week.recoveryBudget,
        school,
    );
    const ref = (s: TypedSession): SessionRef => ({ scheduledDate: s.scheduledDate, sequence: s.sequence });
    let budgetRecord: ConflictRecord['budget'] = null;
    let decision: WeekDecision | null = null;
    let kept = written.map((_, i) => i);
    const asked = placementTrim?.asked ?? null;
    if (asked) decision = 'PENDING';
    // One ask per week: with a placement ask open, the budget only trims easy volume.
    if (resolution.kind === 'trim' || (resolution.kind === 'ask' && asked)) {
        budgetRecord = { kind: 'TRIM', facts: { ...resolution.facts, offered: null } };
        kept = kept.filter((i) => !resolution.removed.includes(i));
    } else if (resolution.kind === 'ask') {
        budgetRecord = {
            kind: 'ASK',
            facts: resolution.facts,
            schoolFit: resolution.schoolFit,
            removed: resolution.removed.map((i) => ref(written[i])),
            keySession: ref(written[resolution.keySessionIndex]),
        };
        decision = 'PENDING';
    }
    const placement: ConflictRecord['placement'] = placementTrim && {
        ...placementTrim,
        // A rewrite spends a retry: with none left, the athlete can only drop the session.
        asked: asked && { ...asked, options: retriesLeft(request.retryCount) > 0 ? ['DROP', 'REWRITE'] : ['DROP'] },
    };
    const conflict: ConflictRecord | null = placement || budgetRecord ? { placement, budget: budgetRecord } : null;
    const anchorRecord = anchor
        ? { provenance: anchor.provenance, sourceId: anchor.sourceId, date: anchor.date, stale: anchor.stale }
        : null;
    const monthKey = currentMonthStartIso();

    await db.$transaction(async (tx) => {
        // The conditional update is the idempotency guard: a second finalize finds nothing to claim.
        const claimed = await tx.planWeek.updateMany({
            where: { id: week.id, generation: { not: 'GENERATED' } },
            data: {
                generation: 'GENERATED',
                ...(conflict && { conflict: conflict as unknown as Prisma.InputJsonValue }),
                ...(decision && { decision }),
            },
        });
        if (claimed.count === 0) return;

        await tx.plannedSession.createMany({
            data: kept.map((i) => {
                const s = written[i];
                const cost = costs[i];
                return {
                    userId,
                    planWeekId: week.id,
                    kind: s.kind,
                    scheduledDate: new Date(`${s.scheduledDate}T00:00:00Z`),
                    sequence: s.sequence,
                    origin: 'AI' as const,
                    plannedLoad: cost.plannedLoad,
                    loadMethod: cost.method,
                    anchor: s.kind === 'RUNNING' && anchorRecord ? anchorRecord : undefined,
                    body: s.body as unknown as Prisma.InputJsonValue,
                    bodyVersion: s.body.bodyVersion,
                };
            }),
        });
        // Pulls are logged for cost tracking only; no cap reads them (ADR 0016).
        await tx.aiUsage.upsert({
            where: { userId_kind_day: { userId, kind: 'plan_pull', day: monthKey } },
            create: { userId, kind: 'plan_pull', day: monthKey, count: 1 },
            update: { count: { increment: 1 } },
        });
    });
    return { kind: 'generated' };
}

export async function retryWeek(userId: string, weekId: string): Promise<RetryOutcome> {
    const week = await loadWeek(userId, weekId);
    if (!week) return { kind: 'not-found' };
    const request = week.aiRequest;
    if (week.generation !== 'FAILED' || !request || request.status !== 'FAILED') return { kind: 'not-failed' };
    if (request.retryCount >= MAX_RETRIES) return { kind: 'limit' };

    const retryCount = request.retryCount + 1;
    const reopened = await db.$transaction(async (tx) => {
        // Claiming the row at the retry count read keeps two parallel retries to one.
        const claimed = await tx.aiRequest.updateMany({
            where: { id: request.id, status: 'FAILED', retryCount: request.retryCount },
            data: { status: 'PENDING', output: null, error: null, retryCount },
        });
        if (claimed.count === 0) return false;
        await tx.planWeek.update({ where: { id: week.id }, data: { generation: 'PENDING' } });
        return true;
    });
    if (!reopened) return { kind: 'not-failed' };
    return { kind: 'retrying', aiRequestId: request.id, retriesLeft: retriesLeft(retryCount) };
}
