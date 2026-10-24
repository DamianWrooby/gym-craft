// Wellbeing check-ins and the two dismissible suggestions (spec #409, stories 77–79). A dismissal
// is stored as the day or week it answered, so the suggestion returns only on new evidence.
import { db } from '$lib/database';
import { toIsoDate } from '$lib/utils/iso-week';
import { readCheckIn } from '$lib/planner/core/check-in';
import { detectDrift, type DriftWeek } from '$lib/planner/core/revision';
import type { ActivePlan } from './repository';
import { keySessionOf } from './stored';
import { athleteToday } from './current-week';

const asDate = (yyyymmdd: string) => new Date(`${yyyymmdd}T00:00:00Z`);

/** One check-in per day; answering again replaces it. */
export async function saveCheckIn(userId: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
    const read = readCheckIn(raw);
    if (!read.ok) return read;
    const date = asDate(await athleteToday(userId));
    const data = { feeling: read.feeling, reason: read.reason };
    await db.wellbeingCheckIn.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, ...data },
        update: data,
    });
    return { ok: true };
}

/** Per finished week: the override record and the key sessions skipped (ADR 0015 drift). */
export function driftWeeksOf(plan: ActivePlan): DriftWeek[] {
    return plan.phases.flatMap((p) =>
        p.weeks.map((w) => ({
            startDate: toIsoDate(w.startDate),
            endDate: toIsoDate(w.endDate),
            decision: w.decision,
            keySessionsSkipped: w.sessions.filter((s) => s.status === 'SKIPPED' && keySessionOf(s.kind, s.body) != null)
                .length,
        })),
    );
}

/** Spends this week's check-ins up to today: a proposal returns only on new poor days. */
export async function dismissCheckInProposal(userId: string): Promise<boolean> {
    const today = await athleteToday(userId);
    const updated = await db.planWeek.updateMany({
        where: {
            userId,
            startDate: { lte: asDate(today) },
            endDate: { gte: asDate(today) },
            phase: { plan: { state: 'ACTIVE' } },
        },
        data: { checkInDismissedOn: asDate(today) },
    });
    return updated.count > 0;
}

/** Holds the recut suggestion until drift continues into a later week. */
export async function dismissRecutSuggestion(userId: string, plan: ActivePlan): Promise<boolean> {
    const drift = detectDrift(driftWeeksOf(plan), await athleteToday(userId));
    if (!drift.latestWeekStart) return false;
    await db.plan.update({ where: { id: plan.id }, data: { recutDismissedFor: asDate(drift.latestWeekStart) } });
    return true;
}
