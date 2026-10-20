// Pull: opening the current week writes the next one (ADR 0016). Nothing runs on a schedule, so a
// dormant athlete costs nothing. Pure.

/** The athlete's answer to "How does next week look?". A statement about life, not the body. */
export const WEEK_OUTLOOKS = ['NORMAL', 'BUSY', 'TRAVEL', 'ILL'] as const;
export type WeekOutlook = (typeof WEEK_OUTLOOKS)[number];

/** Judged multipliers applied once to the recovery budget when it is struck (ADR 0024). */
export const OUTLOOK_FACTORS: Record<WeekOutlook, number> = { NORMAL: 1, BUSY: 0.85, TRAVEL: 0.85, ILL: 0.6 };

export interface PullWeek {
    id: string;
    startDate: string;
    endDate: string;
    /** The week already has its AI request: it was pulled (or bootstrapped) before. */
    hasRequest: boolean;
}

/**
 * The week a pull writes on `today`: the current week when the athlete was away for it, else the
 * next week. Null when both already have their request, or outside the horizon.
 */
export function pullTarget<W extends PullWeek>(weeks: W[], today: string): W | null {
    const current = weeks.findIndex((w) => today >= w.startDate && today <= w.endDate);
    if (current < 0) return null;
    if (!weeks[current].hasRequest) return weeks[current];
    const next = weeks[current + 1];
    return next && !next.hasRequest ? next : null;
}

/** Past sessions nobody marked done or skipped: the pull lists them before writing on. */
export function unconfirmedSessions<S extends { status: string; scheduledDate: string }>(
    sessions: S[],
    today: string,
): S[] {
    return sessions.filter((s) => s.status === 'PLANNED' && s.scheduledDate < today);
}
