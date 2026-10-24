// Re-evaluate (ADR 0015): an event decides when, the current plan week decides what. The outcome
// is no change, a revision of the remaining sessions, or an ask. Pure.
import type { TypedSession } from './session';

/** What started a re-evaluation. `ATHLETE` and `CHECK_IN` are athlete-confirmed requests. */
export const REVISION_TRIGGERS = ['SESSION_DONE', 'SESSION_SKIPPED', 'UNSCHEDULED', 'ATHLETE', 'CHECK_IN'] as const;
export type RevisionTrigger = (typeof REVISION_TRIGGERS)[number];

export interface ReevalSession {
    id: string;
    origin: 'AI' | 'ATHLETE';
    status: 'PLANNED' | 'DONE' | 'SKIPPED' | 'SUPERSEDED';
    scheduledDate: string;
    plannedLoad: number;
    /** The linked activity's load; a session marked done by hand counts its planned load. */
    actualLoad: number | null;
    keySession: string | null;
}

export interface ReevalInput {
    today: string;
    /** The week's frozen recovery budget; null when none was struck (ungated). */
    budget: number | null;
    sessions: ReevalSession[];
    /** Load of executed activities linked to no planned session (unscheduled activities). */
    unscheduledLoad: number;
    trigger: RevisionTrigger;
    /** The day the last revision rewrote from; a key session missed before it is already absorbed. */
    lastRevisedOn: string | null;
}

/** The cause in auditable numbers (ADR 0015 borrows 0013's form). */
export interface RevisionReason {
    executedLoad: number;
    remainingLoad: number;
    budget: number | null;
    /** 0 when the week fits or is ungated. */
    overspend: number;
    missedKeySessions: string[];
}

export interface Reevaluation {
    kind: 'no-change' | 'revise' | 'ask';
    /** Session ids a revision rewrites; empty unless `revise`. */
    scope: string[];
    reason: RevisionReason;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const total = (loads: number[]) => round1(loads.reduce((t, l) => t + l, 0));

const isAthleteRequest = (trigger: RevisionTrigger) => trigger === 'ATHLETE' || trigger === 'CHECK_IN';

export function reevaluate(input: ReevalInput): Reevaluation {
    const live = input.sessions.filter((s) => s.status !== 'SUPERSEDED');
    const remaining = live.filter((s) => s.status === 'PLANNED' && s.scheduledDate >= input.today);
    const executedLoad = total([
        ...live.filter((s) => s.status === 'DONE').map((s) => s.actualLoad ?? s.plannedLoad),
        input.unscheduledLoad,
    ]);
    const remainingLoad = total(remaining.map((s) => s.plannedLoad));
    const missed = live.filter(
        (s) =>
            s.keySession != null &&
            (s.status === 'SKIPPED' || (s.status === 'PLANNED' && s.scheduledDate < input.today)) &&
            (input.lastRevisedOn == null || s.scheduledDate >= input.lastRevisedOn),
    );
    const overspend = input.budget == null ? 0 : Math.max(0, round1(executedLoad + remainingLoad - input.budget));
    const reason: RevisionReason = {
        executedLoad,
        remainingLoad,
        budget: input.budget,
        overspend,
        missedKeySessions: missed.map((s) => s.keySession as string),
    };

    // The athlete asked: everything left is theirs to have rewritten, their own sessions included.
    if (isAthleteRequest(input.trigger)) {
        const scope = remaining.map((s) => s.id);
        return { kind: scope.length > 0 ? 'revise' : 'no-change', scope, reason };
    }

    if (overspend === 0 && missed.length === 0) return { kind: 'no-change', scope: [], reason };
    // The app never overrides the athlete: only AI sessions are rewritten automatically.
    const scope = remaining.filter((s) => s.origin === 'AI').map((s) => s.id);
    if (scope.length === 0) return { kind: 'ask', scope, reason };
    return { kind: 'revise', scope, reason };
}

/** A finished plan week, as drift reads it: the per-week override record plus skipped key sessions. */
export interface DriftWeek {
    startDate: string;
    endDate: string;
    /** The athlete's answer to a budget ask (ADR 0013); `KEPT` is the override record. */
    decision: 'PENDING' | 'DROPPED' | 'DOWNGRADED' | 'KEPT' | null;
    keySessionsSkipped: number;
}

export interface Drift {
    drifting: boolean;
    /** Drifting weeks among the last three finished ones. */
    driftWeeks: number;
    /** Start of the latest drifting week; a dismissal holds until a later week drifts. */
    latestWeekStart: string | null;
}

/** Judged, not sourced (ADR 0015): ignores one sick week, catches a pattern. */
const DRIFT_WINDOW = 3;
const DRIFT_THRESHOLD = 2;

const keySessionsDropped = (w: DriftWeek) =>
    w.keySessionsSkipped > 0 || w.decision === 'DROPPED' || w.decision === 'DOWNGRADED' || w.decision === 'KEPT';

/** Key sessions dropped or overridden in 2 of the last 3 finished weeks. */
export function detectDrift(weeks: DriftWeek[], today: string): Drift {
    const window = weeks
        .filter((w) => w.endDate < today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(-DRIFT_WINDOW);
    const drifted = window.filter(keySessionsDropped);
    return {
        drifting: drifted.length >= DRIFT_THRESHOLD,
        driftWeeks: drifted.length,
        latestWeekStart: drifted.at(-1)?.startDate ?? null,
    };
}

/** The recut suggestion shows on drift unless dismissed for this drift's latest week. */
export function recutSuggestionShown(drift: Drift, dismissedFor: string | null): boolean {
    if (!drift.drifting || !drift.latestWeekStart) return false;
    return dismissedFor == null || drift.latestWeekStart > dismissedFor;
}

/** A session on its day, as the moved-day check reads it. */
export interface DaySession {
    title: string;
    keySession: string | null;
    cutKey: string | null;
    date: string;
}

export const daySessionOf = (s: TypedSession): DaySession => ({
    title: s.body.title,
    keySession: s.kind === 'RUNNING' ? s.body.keySession : null,
    cutKey: s.kind === 'RUNNING' ? s.body.cutKey : null,
    date: s.scheduledDate,
});

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayName = (date: string) => WEEKDAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];

/**
 * One line per session a rewrite moved to another day (ADR 0026). A key session matches by its key.
 * Any other matches by title, else by cut type, as a rewrite often renames an easy run. A session the
 * rewrite dropped or kept on its day says nothing.
 */
export function movedSessions(before: DaySession[], after: DaySession[]): string[] {
    const unmatched = [...after];
    const take = (match: (s: DaySession) => boolean) => {
        const at = unmatched.findIndex(match);
        return at < 0 ? null : unmatched.splice(at, 1)[0];
    };
    // Exact matches first, so a cut-type match never takes a session another one names.
    const pairs = before.map((old) =>
        take((s) =>
            old.keySession != null ? s.keySession === old.keySession : s.keySession == null && s.title === old.title,
        ),
    );
    return before.flatMap((old, i) => {
        const now =
            pairs[i] ??
            (old.keySession == null && old.cutKey != null
                ? take((s) => s.keySession == null && s.cutKey === old.cutKey)
                : null);
        if (!now || now.date === old.date) return [];
        return [`${old.title} moved from ${weekdayName(old.date)} to ${weekdayName(now.date)}.`];
    });
}
