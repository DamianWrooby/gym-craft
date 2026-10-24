// One typed reader per planner JSON column, so callers never cast. A malformed row reads as null.
import type { Prisma } from '@prisma/client';
import { REVISION_TRIGGERS, type RevisionReason, type RevisionTrigger } from '$lib/planner/core/revision';
import type { ConflictRecord } from '$lib/planner/core/conflict';
import type { Anchor } from '$lib/planner/core/anchor';
import type { PlannedLoadMethod, RunningBody } from '$lib/planner/core/session';

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

/** What a revision request rewrites, stored on the request input beside the prompt. */
export interface RevisionScope {
    scope: string[];
    from: string;
    executedLoad: number;
}

const OUTCOMES: readonly string[] = ['revise', 'ask', 'capped'];

type Json = Prisma.JsonValue | null | undefined;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

/** A plain value as a JSON column write. */
export const toJson = (value: unknown) => value as Prisma.InputJsonValue;

export function readRevisionCause(json: Json): RevisionCause | null {
    if (!isRecord(json) || !(REVISION_TRIGGERS as readonly unknown[]).includes(json.trigger)) return null;
    const cause: RevisionCause = { trigger: json.trigger as RevisionTrigger };
    if (isStrings(json.activityIds)) cause.activityIds = json.activityIds;
    if (typeof json.plannedSessionId === 'string') cause.plannedSessionId = json.plannedSessionId;
    return cause;
}

export function readRevisionReason(json: Json): StoredRevisionReason | null {
    if (!isRecord(json)) return null;
    const { executedLoad, remainingLoad, budget, overspend, missedKeySessions, outcome, scope, from } = json;
    const valid =
        isNumber(executedLoad) &&
        isNumber(remainingLoad) &&
        (budget === null || isNumber(budget)) &&
        isNumber(overspend) &&
        isStrings(missedKeySessions) &&
        typeof outcome === 'string' &&
        OUTCOMES.includes(outcome) &&
        isStrings(scope) &&
        typeof from === 'string';
    if (!valid) return null;
    return {
        executedLoad,
        remainingLoad,
        budget,
        overspend,
        missedKeySessions,
        outcome: outcome as StoredRevisionReason['outcome'],
        scope,
        from,
    };
}

/** The scope on a revision request's input; null on a plain week request. */
export function readRevisionScope(input: Json): RevisionScope | null {
    const target = isRecord(input) ? input.revisionScope : null;
    if (!isRecord(target)) return null;
    const { scope, from, executedLoad } = target;
    if (!isStrings(scope) || typeof from !== 'string' || !isNumber(executedLoad)) return null;
    return { scope, from, executedLoad };
}

export const titleOf = (body: unknown) => (isRecord(body) && typeof body.title === 'string' ? body.title : 'Session');

export const keySessionOf = (kind: string, body: unknown) =>
    kind === 'RUNNING' && isRecord(body) && typeof body.keySession === 'string' ? body.keySession : null;

const BUDGET_KINDS: readonly unknown[] = ['TRIM', 'ASK'];
const PLANNED_METHODS: readonly string[] = ['LABEL_TABLE', 'DURATION', 'ATHLETE_ESTIMATE'];

/** The trim, ask or placement trim a week stores (ADR 0013). */
export function readConflict(json: Json): ConflictRecord | null {
    if (!isRecord(json) || !('placement' in json) || !('budget' in json)) return null;
    if (json.budget !== null && !(isRecord(json.budget) && BUDGET_KINDS.includes(json.budget.kind))) return null;
    return json as unknown as ConflictRecord;
}

/** A running session's body; null for another kind or a body with no steps. */
export function readRunningBody(kind: string, body: unknown): RunningBody | null {
    if (kind !== 'RUNNING' || !isRecord(body) || !Array.isArray(body.steps)) return null;
    return body as unknown as RunningBody;
}

/** The anchor a week's prompt was built with, read back from its request input. */
export function readAnchor(input: Json): Anchor | null {
    return isRecord(input) && isRecord(input.anchor) ? (input.anchor as unknown as Anchor) : null;
}

/** A planned row is costed before it is run, so its method is a planned one; anything else counts as duration. */
export const plannedMethodOf = (method: string): PlannedLoadMethod =>
    PLANNED_METHODS.includes(method) ? (method as PlannedLoadMethod) : 'DURATION';
