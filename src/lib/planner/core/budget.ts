// Budget (ADR 0011): one spendable TRIMP ceiling per plan week, struck once and frozen. Pure.
import type { PlannedLoadMethod } from './session';

/** This app's own ACWR boundary between optimal and overreach (`interpretAcwr`). */
export const BUDGET_ACWR_CEILING = 1.3;
/** The chronic window: a shorter history is a smaller denominator wearing the same name. */
export const BUDGET_MIN_HISTORY_DAYS = 28;

export interface BudgetInput {
    /** Average daily training load over the last 28 days. */
    chronicLoad: number;
    /** Days since the athlete's first tracked activity. */
    historyDays: number;
    inHorizonDays: number;
    outlookFactor: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** `1.3 × chronic × days × outlook`, or null: absent, never a pass, when the history cannot carry it. */
export function strikeBudget(input: BudgetInput): number | null {
    if (input.historyDays < BUDGET_MIN_HISTORY_DAYS || input.chronicLoad <= 0) return null;
    return round1(BUDGET_ACWR_CEILING * input.chronicLoad * input.inHorizonDays * input.outlookFactor);
}

/** Methods costed at a flat rate or from the athlete's guess, never from zones or a school table. */
export const FALLBACK_METHODS: readonly string[] = ['DURATION', 'ATHLETE_ESTIMATE'];

export function fallbackShare(items: { load: number; method: string | null }[]): number {
    const total = items.reduce((sum, i) => sum + i.load, 0);
    if (total <= 0) return 0;
    const guessed = items.filter((i) => i.method != null && FALLBACK_METHODS.includes(i.method));
    return round2(guessed.reduce((sum, i) => sum + i.load, 0) / total);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface WeekEvaluation {
    plannedTotal: number;
    /** `budget − plannedTotal`; negative is the overspend. Null without a budget. */
    remainder: number | null;
    /** Two values only: under-spending is not a finding (ADR 0011). */
    verdict: 'within' | 'over' | null;
    fallbackShare: number;
}

export function evaluateWeek(
    sessions: { plannedLoad: number; method: PlannedLoadMethod }[],
    budget: number | null,
): WeekEvaluation {
    const plannedTotal = round1(sessions.reduce((sum, s) => sum + s.plannedLoad, 0));
    const share = fallbackShare(sessions.map((s) => ({ load: s.plannedLoad, method: s.method })));
    if (budget == null) return { plannedTotal, remainder: null, verdict: null, fallbackShare: share };
    const remainder = round1(budget - plannedTotal);
    return { plannedTotal, remainder, verdict: remainder < 0 ? 'over' : 'within', fallbackShare: share };
}
