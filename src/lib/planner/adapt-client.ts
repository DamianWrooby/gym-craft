// Browser side of revisions and check-ins (ADR 0015). Like week generation, the browser holds only
// ids: it asks the proxy to run a revision's AI request, then asks the app to finalize it.
import { m } from '$lib/paraglide/messages.js';
import { runOnProxy } from './generation-client';
import type { RecutResult } from './core/recut';
import type { SchoolId } from './schools/types';

export type RevisionRunResult =
    { revision: 'GENERATED' } | { revision: 'FAILED'; retriesLeft: number } | { revision: 'PENDING' };

async function post(url: string, body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> | null }> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ok: response.ok, json: await response.json().catch(() => null) };
}

const messageOf = (json: Record<string, unknown> | null, fallback: string) =>
    typeof json?.message === 'string' ? json.message : fallback;

export async function finalizeRevision(userId: string, weekId: string): Promise<RevisionRunResult> {
    const { ok, json } = await post(`/api/user/${userId}/plan/weeks/${weekId}/revision/finalize`);
    if (!ok || !json?.data) return { revision: 'PENDING' };
    return json.data as RevisionRunResult;
}

export async function runRevision(input: {
    userId: string;
    weekId: string;
    aiRequestId: string;
    session: string;
}): Promise<RevisionRunResult> {
    await runOnProxy(input.session, input.aiRequestId);
    return finalizeRevision(input.userId, input.weekId);
}

export async function retryRevision(userId: string, weekId: string): Promise<{ ok: true } | { error: string }> {
    const { ok, json } = await post(`/api/user/${userId}/plan/weeks/${weekId}/revision/retry`);
    return ok ? { ok: true } : { error: messageOf(json, m.client_retry_failed()) };
}

/** The outcome kinds the revision route answers with. */
export type RevisionRequestKind = 'no-change' | 'ask' | 'capped' | 'requested';

export async function requestRevision(
    userId: string,
    trigger: 'ATHLETE' | 'CHECK_IN',
): Promise<{ kind: RevisionRequestKind } | { error: string }> {
    const { ok, json } = await post(`/api/user/${userId}/plan/revision`, { trigger });
    if (!ok) return { error: messageOf(json, m.client_revision_failed()) };
    return { kind: (json?.data as { kind: RevisionRequestKind }).kind };
}

export async function saveCheckIn(
    userId: string,
    feeling: string,
    reason: string | null,
): Promise<{ ok: true } | { error: string }> {
    const { ok, json } = await post(`/api/user/${userId}/plan/check-ins`, { feeling, reason });
    return ok ? { ok: true } : { error: messageOf(json, m.client_checkin_failed()) };
}

export async function dismissCheckInProposal(userId: string): Promise<void> {
    await post(`/api/user/${userId}/plan/check-ins/dismiss`);
}

export async function dismissRecutSuggestion(userId: string): Promise<void> {
    await post(`/api/user/${userId}/plan/recut-suggestion/dismiss`);
}

export interface RecutAnswer {
    applied: boolean;
    kind: Exclude<RecutResult['kind'], 'refused'>;
    summary: string;
    losses: string[];
}

/** Previews a recut (or applies it with `confirm`); an absorbed goal-date move is applied at once. */
export async function recutPlan(
    userId: string,
    change: { endDate?: string; schoolId?: SchoolId },
    confirm = false,
): Promise<RecutAnswer | { error: string }> {
    const { ok, json } = await post(`/api/user/${userId}/plan/recut`, { ...change, confirm });
    if (!ok) return { error: messageOf(json, m.client_recut_failed()) };
    return json?.data as RecutAnswer;
}

/** Abandons the active plan so the athlete can start a new one (#435). Costs one plan revision. */
export async function abandonPlan(userId: string): Promise<{ ok: true } | { error: string }> {
    const { ok, json } = await post(`/api/user/${userId}/plan/abandon`);
    if (!ok) return { error: messageOf(json, m.client_abandon_failed()) };
    return { ok: true };
}
