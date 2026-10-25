// Builds the page's adapt view for the current week (stories 68–79). Read-only, apart from
// finalizing a revision whose request finished while no tab was open (ADR 0014's pattern).
import { db } from '$lib/database';
import { dateInTimezone, toIsoDate, fromIsoDate } from '$lib/utils/iso-week';
import { getLimit, type SubscriptionTier } from '@/constants/subscription.constants';
import { checkInProposal } from '$lib/planner/core/check-in';
import { detectDrift, recutSuggestionShown } from '$lib/planner/core/revision';
import type { AdaptRevision, AdaptView } from '$lib/planner/adapt-view';
import type { ActivePlan } from './repository';
import { retriesLeft } from './week-job';
import { finalizeRevision, revisionsUsed } from './revision';
import { readRevisionCause, readRevisionReason, titleOf } from './stored';
import { weekOn } from './current-week';
import { driftWeeksOf } from './check-ins';

type StoredWeek = ActivePlan['phases'][number]['weeks'][number];

function currentWeekOf(plan: ActivePlan, today: string): StoredWeek | null {
    return weekOn(plan.phases, today)?.week ?? null;
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
    const cause = readRevisionCause(week.revisionCause);
    const reason = readRevisionReason(week.revisionReason);
    const request = week.revisionRequest;
    return {
        weekId: week.id,
        generation: week.revisionGeneration,
        request: request
            ? { id: request.id, status: request.status, retriesLeft: retriesLeft(request.retryCount) }
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
    timezone: string,
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
            where: { userId, date: { gte: fromIsoDate(weekStart), lte: fromIsoDate(today) } },
        }),
    ]);
    // What replaced each superseded row; an athlete edit writes an ATHLETE successor.
    const successors = new Map(
        [...(written?.sessions ?? []), ...superseded].filter((s) => s.supersedesId).map((s) => [s.supersedesId, s]),
    );

    const days = checkIns.map((c) => ({ date: toIsoDate(c.date), feeling: c.feeling, reason: c.reason }));
    const todays = days.find((c) => c.date === today) ?? null;
    // A dismissal is a stored day; a revision is an instant, read in the athlete's timezone.
    const lastAnswered = [
        week?.checkInDismissedOn ? toIsoDate(week.checkInDismissedOn) : null,
        week?.revisedAt ? dateInTimezone(week.revisedAt, timezone) : null,
    ]
        .filter((d): d is string => d != null)
        .sort()
        .at(-1);
    const drift = detectDrift(driftWeeksOf(plan), today);

    return {
        revisions: { used, cap: getLimit(tier, 'planRevisionsPerMonth') },
        revision: written ? revisionOf(written) : null,
        superseded: superseded.map((s) => ({
            id: s.id,
            scheduledDate: toIsoDate(s.scheduledDate),
            title: titleOf(s.body),
            plannedLoad: s.plannedLoad,
            byAthlete: successors.get(s.id)?.origin === 'ATHLETE',
            replacedBy: (() => {
                const next = successors.get(s.id);
                return next ? { title: titleOf(next.body), plannedLoad: next.plannedLoad } : null;
            })(),
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
