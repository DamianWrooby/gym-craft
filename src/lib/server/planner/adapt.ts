// Builds the page's adapt view for the current week (stories 68–79). Read-only, apart from
// finalizing a revision whose request finished while no tab was open (ADR 0014's pattern).
import { db } from '$lib/database';
import { toIsoDate } from '$lib/utils/iso-week';
import { getLimit, type SubscriptionTier } from '@/constants/subscription.constants';
import { checkInProposal } from '$lib/planner/core/check-in';
import { detectDrift, recutSuggestionShown } from '$lib/planner/core/revision';
import type { AdaptRevision, AdaptView } from '$lib/planner/adapt-view';
import type { ActivePlan } from './repository';
import { MAX_RETRIES } from './week-generation';
import { finalizeRevision, revisionsUsed, type RevisionCause, type StoredRevisionReason } from './revision';
import { driftWeeksOf } from './check-ins';

type StoredWeek = ActivePlan['phases'][number]['weeks'][number];

const asDate = (yyyymmdd: string) => new Date(`${yyyymmdd}T00:00:00Z`);

function currentWeekOf(plan: ActivePlan, today: string): StoredWeek | null {
    for (const phase of plan.phases) {
        for (const week of phase.weeks) {
            if (toIsoDate(week.startDate) <= today && toIsoDate(week.endDate) >= today) return week;
        }
    }
    return null;
}

/** A revision request that finished while no tab was open. */
export function revisionAwaitsFinalize(plan: ActivePlan, today: string): string | null {
    const week = currentWeekOf(plan, today);
    const status = week?.revisionRequest?.status;
    if (!week || week.revisionGeneration !== 'PENDING') return null;
    return status === 'DONE' || status === 'FAILED' ? week.id : null;
}

export async function finalizePendingRevision(userId: string, plan: ActivePlan, today: string): Promise<boolean> {
    const weekId = revisionAwaitsFinalize(plan, today);
    if (!weekId) return false;
    await finalizeRevision(userId, weekId);
    return true;
}

function revisionOf(week: StoredWeek): AdaptRevision {
    const cause = week.revisionCause as unknown as RevisionCause | null;
    const reason = week.revisionReason as unknown as StoredRevisionReason | null;
    const request = week.revisionRequest;
    return {
        weekId: week.id,
        generation: week.revisionGeneration,
        request: request
            ? { id: request.id, status: request.status, retriesLeft: Math.max(0, MAX_RETRIES - request.retryCount) }
            : null,
        trigger: cause?.trigger ?? null,
        reason,
        revisedAt: week.revisedAt?.toISOString() ?? null,
    };
}

export async function buildAdaptView(
    userId: string,
    plan: ActivePlan,
    tier: SubscriptionTier,
    today: string,
): Promise<AdaptView> {
    const week = currentWeekOf(plan, today);
    const written = week?.generation === 'GENERATED' ? week : null;
    const weekStart = week ? toIsoDate(week.startDate) : today;

    const [used, superseded, checkIns] = await Promise.all([
        revisionsUsed(userId),
        written
            ? db.plannedSession.findMany({
                  where: { planWeekId: written.id, status: 'SUPERSEDED' },
                  orderBy: [{ scheduledDate: 'asc' }, { sequence: 'asc' }],
              })
            : Promise.resolve([]),
        db.wellbeingCheckIn.findMany({
            where: { userId, date: { gte: asDate(weekStart), lte: asDate(today) } },
        }),
    ]);
    // Whoever replaced a superseded row: an athlete edit writes an ATHLETE successor.
    const successors = new Map(
        (written?.sessions ?? []).filter((s) => s.supersedesId).map((s) => [s.supersedesId, s.origin]),
    );

    const days = checkIns.map((c) => ({ date: toIsoDate(c.date), feeling: c.feeling, reason: c.reason }));
    const todays = days.find((c) => c.date === today) ?? null;
    const lastAnswered = [week?.checkInDismissedOn, week?.revisedAt]
        .filter((d): d is Date => d != null)
        .map(toIsoDate)
        .sort()
        .at(-1);
    const drift = detectDrift(driftWeeksOf(plan), today);

    return {
        revisions: { used, cap: getLimit(tier, 'planRevisionsPerMonth') },
        revision: written ? revisionOf(written) : null,
        superseded: superseded.map((s) => ({
            id: s.id,
            scheduledDate: toIsoDate(s.scheduledDate),
            title: (s.body as { title?: string } | null)?.title ?? 'Session',
            plannedLoad: s.plannedLoad,
            byAthlete: successors.get(s.id) === 'ATHLETE',
        })),
        checkIn: {
            today: todays ? { feeling: todays.feeling, reason: todays.reason } : null,
            proposal: written
                ? checkInProposal(days, { weekStart, today, after: lastAnswered ?? null })
                : { proposed: false, poorDays: 0, illDay: false },
        },
        recut: {
            shown: recutSuggestionShown(drift, plan.recutDismissedFor ? toIsoDate(plan.recutDismissedFor) : null),
            driftWeeks: drift.driftWeeks,
        },
    };
}
