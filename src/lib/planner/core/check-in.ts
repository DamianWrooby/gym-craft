// Wellbeing check-in (spec #409, stories 77–78): a daily one-tap answer. Enough poor days propose a
// revision the athlete confirms or dismisses; they never change the week's budget. Pure.

export const FEELINGS = ['GOOD', 'SO_SO', 'POOR'] as const;
export type Feeling = (typeof FEELINGS)[number];

/** Optional, and only on a poor day. */
export const CHECK_IN_REASONS = ['ILL', 'TIRED', 'SORE', 'STRESSED', 'POOR_SLEEP'] as const;
export type CheckInReason = (typeof CHECK_IN_REASONS)[number];

export interface CheckIn {
    date: string;
    feeling: Feeling;
    reason: CheckInReason | null;
}

export interface CheckInProposal {
    proposed: boolean;
    poorDays: number;
    illDay: boolean;
}

/** Two poor days or one ill day in the current week propose a revision (story 78). */
const POOR_DAYS_TO_PROPOSE = 2;

/**
 * Counts this week's check-ins after `after`, the day of the last dismissal or revision: those
 * days were already answered. A missing check-in is no data, never good.
 */
export function checkInProposal(
    checkIns: CheckIn[],
    window: { weekStart: string; today: string; after: string | null },
): CheckInProposal {
    const counted = checkIns.filter(
        (c) =>
            c.feeling === 'POOR' &&
            c.date >= window.weekStart &&
            c.date <= window.today &&
            (window.after == null || c.date > window.after),
    );
    const illDay = counted.some((c) => c.reason === 'ILL');
    return { proposed: illDay || counted.length >= POOR_DAYS_TO_PROPOSE, poorDays: counted.length, illDay };
}

export function readCheckIn(
    raw: unknown,
): { ok: true; feeling: Feeling; reason: CheckInReason | null } | { ok: false; error: string } {
    const body = (raw ?? {}) as { feeling?: unknown; reason?: unknown };
    if (!FEELINGS.includes(body.feeling as Feeling)) return { ok: false, error: 'feeling must be good, so-so or poor' };
    const feeling = body.feeling as Feeling;
    if (body.reason != null && !CHECK_IN_REASONS.includes(body.reason as CheckInReason)) {
        return { ok: false, error: `reason must be one of: ${CHECK_IN_REASONS.join(', ')}` };
    }
    const reason = feeling === 'POOR' ? ((body.reason as CheckInReason | undefined) ?? null) : null;
    return { ok: true, feeling, reason };
}
