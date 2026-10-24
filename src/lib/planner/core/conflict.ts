// Resolve conflict (ADR 0013): the budget sets how much a week may cost, the school sets what goes.
// Easy volume absorbs an overspend silently in the school's cut order; a key session is never
// cut without the athlete's consent. No threshold, no band. Pure.
import type { SchoolDefinition } from '../schools/types';
import { fallbackShare } from './budget';
import { LONG_RUN_KEY } from './placement';
import { isRepeat, type PlannedLoadMethod, type RunBlock, type RunStep, type SessionKind } from './session';

export interface ConflictSession {
    title: string;
    kind: SessionKind;
    plannedLoad: number;
    method: PlannedLoadMethod;
    keySession: string | null;
    cutKey: string | null;
    /** A running key session with at least one step above the school's easiest label. */
    canDowngrade: boolean;
}

/** REWRITE answers a placement ask only: the week is failed so the athlete can retry it. */
export const DECISION_OPTIONS = ['DROP', 'DOWNGRADE', 'KEEP', 'REWRITE'] as const;
export type DecisionOption = (typeof DECISION_OPTIONS)[number];

/** The four facts every trim and every ask carries (ADR 0013). The surface owns the wording. */
export interface ConflictFacts {
    /** The cause, in auditable numbers. */
    plannedTotal: number;
    budget: number;
    overspend: number;
    /** Overspend left after the removals; 0 once the week is within. Nothing else is cut silently. */
    stillOver: number;
    /** The action: what was removed … */
    removed: { title: string; plannedLoad: number; cutKey: string | null }[];
    /** … or what is offered. */
    offered: { title: string; plannedLoad: number; options: DecisionOption[] } | null;
    /** Why those sessions: the school's cut order, cheapest to lose first. */
    cutOrder: string[];
    /** The key sessions left untouched. */
    protected: string[];
    fallbackShare: number;
}

export type Resolution =
    | { kind: 'ungated' }
    | { kind: 'within' }
    | { kind: 'trim'; removed: number[]; facts: ConflictFacts }
    | {
          kind: 'ask';
          /** Easy sessions removed along with a drop or downgrade; a keep restores them. */
          removed: number[];
          keySessionIndex: number;
          /** The key sessions alone exceed the budget: the school's minimum week does not fit. */
          schoolFit: boolean;
          facts: ConflictFacts;
      };

const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (sessions: ConflictSession[]) => round1(sessions.reduce((t, s) => t + s.plannedLoad, 0));

/** Non-key runs the school ranks, cheapest to lose first; ties go to the smaller session. */
export function cutCandidates(
    sessions: { kind: SessionKind; keySession: string | null; cutKey: string | null; plannedLoad: number }[],
    cutOrder: string[],
): number[] {
    return sessions
        .map((s, i) => ({ s, i, rank: s.cutKey ? cutOrder.indexOf(s.cutKey) : -1 }))
        .filter(({ s, rank }) => s.kind === 'RUNNING' && s.keySession == null && rank >= 0)
        .sort((a, b) => a.rank - b.rank || a.s.plannedLoad - b.s.plannedLoad)
        .map(({ i }) => i);
}

export function resolveConflict(
    sessions: ConflictSession[],
    budget: number | null,
    school: Pick<SchoolDefinition, 'cutOrder'>,
): Resolution {
    if (budget == null) return { kind: 'ungated' };
    const plannedTotal = sum(sessions);
    if (plannedTotal <= budget) return { kind: 'within' };

    const cutOrder = school.cutOrder.value;
    const removed: number[] = [];
    let total = plannedTotal;
    for (const i of cutCandidates(sessions, cutOrder)) {
        if (total <= budget) break;
        removed.push(i);
        total = round1(total - sessions[i].plannedLoad);
    }

    const keys = sessions.map((s, i) => ({ s, i })).filter(({ s }) => s.keySession != null);
    const base = {
        plannedTotal,
        budget,
        overspend: round1(plannedTotal - budget),
        stillOver: Math.max(0, round1(total - budget)),
        removed: removed.map((i) => ({
            title: sessions[i].title,
            plannedLoad: sessions[i].plannedLoad,
            cutKey: sessions[i].cutKey,
        })),
        cutOrder,
        fallbackShare: fallbackShare(sessions.map((s) => ({ load: s.plannedLoad, method: s.method }))),
    };

    if (total <= budget || keys.length === 0) {
        return {
            kind: 'trim',
            removed,
            facts: { ...base, offered: null, protected: keys.map(({ s }) => s.title) },
        };
    }

    // The long run is shortened, never removed; it is offered only when nothing else is key.
    const offerable = keys.filter(({ s }) => s.keySession !== LONG_RUN_KEY);
    const pool = offerable.length > 0 ? offerable : keys;
    const offered = pool.reduce((a, b) => (b.s.plannedLoad > a.s.plannedLoad ? b : a));
    const options: DecisionOption[] = offered.s.canDowngrade ? ['DROP', 'DOWNGRADE', 'KEEP'] : ['DROP', 'KEEP'];

    return {
        kind: 'ask',
        removed,
        keySessionIndex: offered.i,
        schoolFit: sum(keys.map(({ s }) => s)) > budget,
        facts: {
            ...base,
            offered: { title: offered.s.title, plannedLoad: offered.s.plannedLoad, options },
            protected: keys.filter(({ i }) => i !== offered.i).map(({ s }) => s.title),
        },
    };
}

/**
 * The ask when only the athlete's own sessions remain and the week is over budget (ADR 0015: the app
 * never overrides the athlete). Nothing is cut silently; one session is offered, the hardest
 * non-long key session first, else the biggest. The numbers cover the whole week, executed included.
 */
export function athleteSessionsAsk(
    sessions: ConflictSession[],
    week: { executedLoad: number; budget: number },
    school: Pick<SchoolDefinition, 'cutOrder'>,
): Extract<Resolution, { kind: 'ask' }> {
    const plannedTotal = round1(week.executedLoad + sum(sessions));
    const overspend = Math.max(0, round1(plannedTotal - week.budget));
    const indexed = sessions.map((s, i) => ({ s, i }));
    const keys = indexed.filter(({ s }) => s.keySession != null);
    const offerable = keys.filter(({ s }) => s.keySession !== LONG_RUN_KEY);
    const pool = offerable.length > 0 ? offerable : keys.length > 0 ? keys : indexed;
    const offered = pool.reduce((a, b) => (b.s.plannedLoad > a.s.plannedLoad ? b : a));
    const options: DecisionOption[] = offered.s.canDowngrade ? ['DROP', 'DOWNGRADE', 'KEEP'] : ['DROP', 'KEEP'];
    return {
        kind: 'ask',
        removed: [],
        keySessionIndex: offered.i,
        schoolFit: false,
        facts: {
            plannedTotal,
            budget: week.budget,
            overspend,
            stillOver: overspend,
            removed: [],
            offered: { title: offered.s.title, plannedLoad: offered.s.plannedLoad, options },
            cutOrder: school.cutOrder.value,
            protected: keys.filter(({ i }) => i !== offered.i).map(({ s }) => s.title),
            fallbackShare: fallbackShare(sessions.map((s) => ({ load: s.plannedLoad, method: s.method }))),
        },
    };
}

/** Labels from easiest to hardest by the school's Edwards weight. */
function labelLadder(school: Pick<SchoolDefinition, 'intensityLabels'>): string[] {
    return [...school.intensityLabels].sort((a, b) => a.edwardsWeight.value - b.edwardsWeight.value).map((l) => l.key);
}

/** Each step one intensity label down: intervals become tempo. The easiest label stays as it is. */
export function downgradeSteps(blocks: RunBlock[], school: Pick<SchoolDefinition, 'intensityLabels'>): RunBlock[] {
    const ladder = labelLadder(school);
    // The old pace or HR target belonged to the old label; the server attaches the new one.
    const down = (step: RunStep): RunStep => {
        const label = ladder[Math.max(0, ladder.indexOf(step.label) - 1)] ?? step.label;
        if (label === step.label) return step;
        const next = { ...step, label };
        delete next.target;
        return next;
    };
    return blocks.map((b) => (isRepeat(b) ? { ...b, steps: b.steps.map(down) } : down(b)));
}

/** True when a downgrade would change at least one step. */
export function canDowngrade(blocks: RunBlock[], school: Pick<SchoolDefinition, 'intensityLabels'>): boolean {
    const easiest = labelLadder(school)[0];
    return blocks.some((b) => (isRepeat(b) ? b.steps.some((s) => s.label !== easiest) : b.label !== easiest));
}

/** A stored session, found again by its day and its place in that day. */
export interface SessionRef {
    scheduledDate: string;
    sequence: number;
}

/** A key session left out so the week places (story 60): the athlete drops it or asks for a rewrite. */
export interface PlacementAsk {
    title: string;
    plannedLoad: number;
    keySession: string;
}

/** What a finalize cut or asked, stored on the plan week; null when the week stands as written. */
export interface ConflictRecord {
    placement: {
        removed: ConflictFacts['removed'];
        violations: string[];
        cutOrder: string[];
        protected: string[];
        /** Absent on weeks stored before the placement ask. */
        asked?: (PlacementAsk & { options: DecisionOption[] }) | null;
    } | null;
    budget:
        | { kind: 'TRIM'; facts: ConflictFacts }
        | { kind: 'ASK'; facts: ConflictFacts; schoolFit: boolean; removed: SessionRef[]; keySession: SessionRef }
        | null;
}
