// A week job: the AI request that fills one slot of a plan week, its generation or its revision
// (ADR 0014). Owns the lifecycle both slots share: staleness, failing, the finalize gate and the
// retry claim (ADR 0016). What a DONE output means stays with the slot's own module.
import { db } from '$lib/database';
import { createResponse } from '$lib/utils/response';
import type { AiRequest } from '@prisma/client';

export type WeekSlot = 'generation' | 'revision';

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

export const retriesLeft = (retryCount: number) => Math.max(0, MAX_RETRIES - retryCount);

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

const STATUS_COLUMN = { generation: 'generation', revision: 'revisionGeneration' } as const;

async function loadJobWeek(userId: string, weekId: string) {
    const week = await db.planWeek.findUnique({
        where: { id: weekId },
        include: {
            aiRequest: true,
            revisionRequest: true,
            phase: { include: { plan: true } },
            sessions: { where: { status: { not: 'SUPERSEDED' } } },
        },
    });
    return week && week.userId === userId ? week : null;
}

export type JobWeek = NonNullable<Awaited<ReturnType<typeof loadJobWeek>>>;

const slotOf = (week: JobWeek, slot: WeekSlot) =>
    slot === 'generation'
        ? { status: week.generation, request: week.aiRequest }
        : { status: week.revisionGeneration, request: week.revisionRequest };

async function fail(week: JobWeek, slot: WeekSlot, requestId: string, error: string | null): Promise<void> {
    await db.$transaction(async (tx) => {
        if (error != null) await tx.aiRequest.update({ where: { id: requestId }, data: { status: 'FAILED', error } });
        await tx.planWeek.update({ where: { id: week.id }, data: { [STATUS_COLUMN[slot]]: 'FAILED' } });
    });
}

/**
 * Stores a DONE request's output: returns null once stored, or the error that fails the request.
 * Must be idempotent, since two finalizes can both reach it.
 */
export type StoreOutput = (week: JobWeek, request: AiRequest) => Promise<string | null>;

/** Settles the slot's request: fails it when stale or failed, stores it when DONE. Idempotent. */
export async function finalizeJob(
    userId: string,
    weekId: string,
    slot: WeekSlot,
    store: StoreOutput,
): Promise<FinalizeOutcome> {
    const week = await loadJobWeek(userId, weekId);
    if (!week) return { kind: 'not-found' };
    const { status, request } = slotOf(week, slot);
    if (status === 'GENERATED') return { kind: 'generated' };
    if (!request) return { kind: 'pending', requestStatus: 'NONE' };

    const failed = async (error: string | null) => {
        await fail(week, slot, request.id, error);
        return { kind: 'failed' as const, retriesLeft: retriesLeft(request.retryCount) };
    };
    const stalled = staleReason(request);
    if (stalled) return failed(stalled);
    if (request.status === 'FAILED') {
        if (status === 'FAILED') return { kind: 'failed', retriesLeft: retriesLeft(request.retryCount) };
        return failed(null);
    }
    if (request.status !== 'DONE') return { kind: 'pending', requestStatus: request.status };

    const error = await store(week, request);
    if (error != null) return failed(error.slice(0, 1000));
    return { kind: 'generated' };
}

/** Re-opens the slot's failed request for the browser to run again, at most MAX_RETRIES times. */
export async function retryJob(userId: string, weekId: string, slot: WeekSlot): Promise<RetryOutcome> {
    const week = await loadJobWeek(userId, weekId);
    if (!week) return { kind: 'not-found' };
    const { status, request } = slotOf(week, slot);
    if (status !== 'FAILED' || !request || request.status !== 'FAILED') return { kind: 'not-failed' };
    if (request.retryCount >= MAX_RETRIES) return { kind: 'limit' };

    const retryCount = request.retryCount + 1;
    const reopened = await db.$transaction(async (tx) => {
        // Claiming the row at the retry count read keeps two parallel retries to one.
        const claimed = await tx.aiRequest.updateMany({
            where: { id: request.id, status: 'FAILED', retryCount: request.retryCount },
            data: { status: 'PENDING', output: null, error: null, retryCount },
        });
        if (claimed.count === 0) return false;
        await tx.planWeek.update({ where: { id: week.id }, data: { [STATUS_COLUMN[slot]]: 'PENDING' } });
        return true;
    });
    if (!reopened) return { kind: 'not-failed' };
    return { kind: 'retrying', aiRequestId: request.id, retriesLeft: retriesLeft(retryCount) };
}

const WORDING = {
    generation: { key: 'generation', noun: 'week' },
    revision: { key: 'revision', noun: 'revision' },
} as const;

export function finalizeResponse(slot: WeekSlot, outcome: FinalizeOutcome): Response {
    const { key } = WORDING[slot];
    switch (outcome.kind) {
        case 'not-found':
            return createResponse(404, { code: 'NOT_FOUND', message: 'Plan week not found' });
        case 'generated':
            return createResponse(200, { data: { [key]: 'GENERATED' } });
        case 'pending':
            return createResponse(202, { data: { [key]: 'PENDING', requestStatus: outcome.requestStatus } });
        case 'failed':
            return createResponse(200, { data: { [key]: 'FAILED', retriesLeft: outcome.retriesLeft } });
    }
}

export function retryResponse(slot: WeekSlot, outcome: RetryOutcome): Response {
    const { noun } = WORDING[slot];
    switch (outcome.kind) {
        case 'not-found':
            return createResponse(404, { code: 'NOT_FOUND', message: 'Plan week not found' });
        case 'not-failed':
            return createResponse(409, { code: 'NOT_FAILED', message: `Only a failed ${noun} can be retried` });
        case 'limit':
            return createResponse(429, {
                code: 'RETRY_LIMIT',
                message: `This ${noun} was already retried ${MAX_RETRIES} times`,
            });
        case 'retrying':
            return createResponse(200, {
                data: { aiRequestId: outcome.aiRequestId, retriesLeft: outcome.retriesLeft },
            });
    }
}
