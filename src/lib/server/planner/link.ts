// Linked sessions (spec #409, stories 62–64, 67): pairs synced activities with planned sessions.
// Evidence beats a guess: a late activity settles a session the athlete skipped or marked done.
import { db } from '$lib/database';
import { dateInTimezone, toIsoDate } from '$lib/utils/iso-week';
import { activityKindOf, matchActivities, plannedDurationSec, type MatchActivity } from '$lib/planner/core/match';
import type { OtherModality } from '$lib/planner/core/session';
import type { SessionWriteOutcome } from './sessions';

/** Sessions an activity may still settle: unlinked and not replaced. Includes SKIPPED and
 * marked DONE, because late evidence wins (ADR 0023 §10). */
const SETTLEABLE = { activityId: null, status: { not: 'SUPERSEDED' as const } };

async function timezoneOf(userId: string): Promise<string> {
    const profile = await db.athleteProfile.findUnique({ where: { userId }, select: { timezone: true } });
    return profile?.timezone ?? 'UTC';
}

async function activeWeeks(userId: string) {
    const plan = await db.plan.findFirst({
        where: { userId, state: 'ACTIVE' },
        select: { phases: { select: { weeks: { select: { id: true, startDate: true, endDate: true } } } } },
    });
    return (plan?.phases ?? []).flatMap((p) =>
        p.weeks.map((w) => ({ id: w.id, startDate: toIsoDate(w.startDate), endDate: toIsoDate(w.endDate) })),
    );
}

/**
 * Runs Match activities over newly synced activities and links each pair, setting the session
 * `DONE`. Returns the activities linked to no session (unscheduled activities); the
 * once-per-batch re-evaluation that reads them arrives with revisions (#418, ADR 0023 §8).
 */
export async function linkSyncedActivities(userId: string, activityIds: string[]): Promise<{ unscheduled: string[] }> {
    if (activityIds.length === 0) return { unscheduled: [] };
    const weeks = await activeWeeks(userId);
    if (weeks.length === 0) return { unscheduled: [] };

    const [timezone, rows, alreadyLinked] = await Promise.all([
        timezoneOf(userId),
        db.activity.findMany({
            where: { userId, id: { in: activityIds } },
            select: { id: true, activityType: true, startTime: true, durationSec: true, trimpLoad: true },
        }),
        db.plannedSession.findMany({
            where: { userId, activityId: { in: activityIds } },
            select: { activityId: true },
        }),
    ]);
    const linked = new Set(alreadyLinked.map((s) => s.activityId));

    const byWeek = new Map<string, MatchActivity[]>();
    for (const row of rows) {
        const kind = activityKindOf(row.activityType);
        if (!kind || linked.has(row.id)) continue;
        const date = dateInTimezone(row.startTime, timezone);
        const week = weeks.find((w) => date >= w.startDate && date <= w.endDate);
        if (!week) continue;
        const list = byWeek.get(week.id) ?? [];
        list.push({
            id: row.id,
            ...kind,
            date,
            startTime: row.startTime.toISOString(),
            durationSec: row.durationSec,
            load: row.trimpLoad,
        });
        byWeek.set(week.id, list);
    }

    const unscheduled: string[] = [];
    for (const [planWeekId, activities] of byWeek) {
        const sessions = await db.plannedSession.findMany({
            where: { userId, planWeekId, ...SETTLEABLE },
            orderBy: [{ scheduledDate: 'asc' }, { sequence: 'asc' }],
        });
        const result = matchActivities(
            sessions.map((s) => ({
                id: s.id,
                kind: s.kind,
                date: toIsoDate(s.scheduledDate),
                durationSec: plannedDurationSec(s.kind, s.body),
                plannedLoad: s.plannedLoad,
                marked: s.status !== 'PLANNED',
                modality: s.kind === 'OTHER' ? ((s.body as { modality?: OtherModality })?.modality ?? 'other') : null,
            })),
            activities,
        );
        for (const link of result.links) {
            // Guarded on a still-open row so a concurrent sync cannot link one session twice.
            const claimed = await db.plannedSession.updateMany({
                where: { id: link.sessionId, activityId: null },
                data: { activityId: link.activityId, status: 'DONE' },
            });
            if (claimed.count === 0) unscheduled.push(link.activityId);
        }
        unscheduled.push(...result.unscheduled);
    }
    return { unscheduled };
}

/** A linked session in the current plan week, or the reason the athlete cannot change it. */
async function currentWeekSession(userId: string, sessionId: string, today: string) {
    const session = await db.plannedSession.findUnique({
        where: { id: sessionId },
        include: { planWeek: { select: { startDate: true, endDate: true } } },
    });
    if (!session || session.userId !== userId) return { ok: false as const, outcome: { kind: 'not-found' } as const };
    const startDate = toIsoDate(session.planWeek.startDate);
    const endDate = toIsoDate(session.planWeek.endDate);
    if (today < startDate || today > endDate) {
        return {
            ok: false as const,
            outcome: { kind: 'locked', reason: 'Only sessions in the current week can be relinked' } as const,
        };
    }
    if (session.status === 'SUPERSEDED') {
        return { ok: false as const, outcome: { kind: 'locked', reason: 'This session was replaced' } as const };
    }
    return { ok: true as const, session, startDate, endDate };
}

/** Undo a wrong match (story 64): the session reopens and the activity becomes unscheduled. */
export async function unlinkSession(userId: string, sessionId: string, today: string): Promise<SessionWriteOutcome> {
    const found = await currentWeekSession(userId, sessionId, today);
    if (!found.ok) return found.outcome;
    if (!found.session.activityId) return { kind: 'locked', reason: 'This session has no linked activity' };
    await db.plannedSession.update({ where: { id: sessionId }, data: { activityId: null, status: 'PLANNED' } });
    return { kind: 'saved', sessionId };
}

/** Pair a session with an activity of the same kind from the same week by hand (story 64). */
export async function linkSession(
    userId: string,
    sessionId: string,
    activityId: unknown,
    today: string,
): Promise<SessionWriteOutcome> {
    if (typeof activityId !== 'string') return { kind: 'invalid', errors: ['activityId is required'] };
    const found = await currentWeekSession(userId, sessionId, today);
    if (!found.ok) return found.outcome;
    const { session, startDate, endDate } = found;
    if (session.activityId) return { kind: 'locked', reason: 'Unlink the current activity first' };

    const activity = await db.activity.findUnique({
        where: { id: activityId },
        select: { userId: true, activityType: true, startTime: true },
    });
    if (!activity || activity.userId !== userId) return { kind: 'not-found' };
    const date = dateInTimezone(activity.startTime, await timezoneOf(userId));
    if (date < startDate || date > endDate) return { kind: 'locked', reason: 'The activity is from another week' };
    if (activityKindOf(activity.activityType)?.kind !== session.kind) {
        return { kind: 'locked', reason: 'The activity is a different kind of training' };
    }
    const taken = await db.plannedSession.findFirst({ where: { activityId }, select: { id: true } });
    if (taken) return { kind: 'locked', reason: 'The activity is linked to another session' };

    const linked = await db.plannedSession.updateMany({
        where: { id: sessionId, activityId: null },
        data: { activityId, status: 'DONE' },
    });
    if (linked.count === 0) return { kind: 'locked', reason: 'This session changed meanwhile' };
    return { kind: 'saved', sessionId };
}
