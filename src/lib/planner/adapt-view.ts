// What the /app/plan page needs to adapt the current week (ADR 0015, stories 68–79): the revision in
// flight or its verdict, the "what changed" rows, revisions left, today's check-in and the recut
// suggestion. Built on the server beside the plan view; types only.
import type { CheckInProposal, CheckInReason, Feeling } from './core/check-in';
import type { RevisionReason, RevisionTrigger } from './core/revision';

export interface AdaptRevision {
    weekId: string;
    /** Null when no revision request was ever written for the week. */
    generation: 'PENDING' | 'GENERATED' | 'FAILED' | null;
    request: { id: string; status: string; retriesLeft: number } | null;
    trigger: RevisionTrigger | null;
    /** The latest verdict; `capped` and `ask` keep the week as written. */
    reason: (RevisionReason & { outcome: 'revise' | 'ask' | 'capped'; from: string }) | null;
    revisedAt: string | null;
}

/** A session a revision replaced, kept for the "what changed" view (story 71). */
export interface SupersededSession {
    id: string;
    scheduledDate: string;
    title: string;
    plannedLoad: number;
    /** Replaced by an athlete edit rather than a revision. */
    byAthlete: boolean;
}

export interface AdaptView {
    revisions: { used: number; cap: number };
    /** The current week's revision state; null outside a written current week. */
    revision: AdaptRevision | null;
    superseded: SupersededSession[];
    checkIn: {
        today: { feeling: Feeling; reason: CheckInReason | null } | null;
        proposal: CheckInProposal;
    };
    recut: { shown: boolean; driftWeeks: number };
}
