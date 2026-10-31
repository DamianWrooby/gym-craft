// The athlete's answer to an ask (ADR 0013): drop the key session, downgrade it, or keep the week as
// written and go over budget. A keep is recorded on this week only, never as a standing preference.
import { db } from '$lib/database';
import { getAthleteProfile } from '$lib/prisma/prisma';
import { toIsoDate } from '$lib/utils/iso-week';
import { getSchool, isSchoolId } from '$lib/planner/schools/catalogue';
import { downgradeSteps, type DecisionOption, type SessionRef } from '$lib/planner/core/conflict';
import { costSession } from '$lib/planner/core/cost';
import { attachTargets, labelPaces } from '$lib/planner/core/targets';
import { isValidZones } from '$lib/planner/core/zones';
import type { RunningBody } from '$lib/planner/core/session';
import { Prisma, type WeekDecision } from '@prisma/client';
import { readAnchor, readConflict, readRunningBody, toJson } from './stored';

export type DecisionOutcome =
    | { kind: 'not-found' }
    | { kind: 'no-ask' }
    | { kind: 'not-offered' }
    | { kind: 'answered'; decision: WeekDecision }
    /** The week is failed for a retry (story 60). */
    | { kind: 'rewrite' };

const RECORDED: Record<Exclude<DecisionOption, 'REWRITE'>, WeekDecision> = {
    DROP: 'DROPPED',
    DOWNGRADE: 'DOWNGRADED',
    KEEP: 'KEPT',
};

class AlreadyAnsweredError extends Error {}

export async function answerDecision(userId: string, weekId: string, choice: DecisionOption): Promise<DecisionOutcome> {
    const week = await db.planWeek.findUnique({
        where: { id: weekId },
        include: {
            phase: true,
            aiRequest: true,
            // An ask over the athlete's own sessions (ADR 0015) offers one of theirs.
            sessions: { where: { status: 'PLANNED' } },
        },
    });
    if (!week || week.userId !== userId) return { kind: 'not-found' };

    const conflict = readConflict(week.conflict);
    if (week.decision !== 'PENDING') return { kind: 'no-ask' };
    const placementAsk = conflict?.placement?.asked;
    if (placementAsk) {
        if (!placementAsk.options.includes(choice)) return { kind: 'not-offered' };
        return answerPlacement(week.id, week.aiRequestId, choice);
    }
    const ask = conflict?.budget;
    if (ask?.kind !== 'ASK' || choice === 'REWRITE') return { kind: 'no-ask' };
    if (!ask.facts.offered?.options.includes(choice)) return { kind: 'not-offered' };

    const find = (r: SessionRef) =>
        week.sessions.find((s) => toIsoDate(s.scheduledDate) === r.scheduledDate && s.sequence === r.sequence);
    const easyIds = ask.removed.map(find).flatMap((s) => (s ? [s.id] : []));
    const key = find(ask.keySession);

    let downgraded: { body: RunningBody; plannedLoad: number } | null = null;
    if (choice === 'DOWNGRADE' && key?.kind === 'RUNNING') {
        if (!isSchoolId(week.phase.school)) throw new Error(`Unknown school on phase: ${week.phase.school}`);
        const school = getSchool(week.phase.school);
        const anchor = readAnchor(week.aiRequest?.input);
        const profile = await getAthleteProfile(userId);
        const zones = isValidZones(profile?.hrZoneBounds) ? profile.hrZoneBounds : null;
        const body = readRunningBody(key.kind, key.body);
        if (!body) throw new Error(`Running session ${key.id} has no steps`);
        const [session] = attachTargets(
            [
                {
                    kind: 'RUNNING',
                    scheduledDate: toIsoDate(key.scheduledDate),
                    sequence: key.sequence,
                    body: { ...body, steps: downgradeSteps(body.steps, school) },
                },
            ],
            { school, anchor, zones },
        );
        const cost = costSession(session, { school, paceSecPerKm: labelPaces(school, anchor) });
        downgraded = { body: session.body as RunningBody, plannedLoad: cost.plannedLoad };
    }

    const decision = RECORDED[choice];
    try {
        await db.$transaction(async (tx) => {
            const claimed = await tx.planWeek.updateMany({
                where: { id: week.id, decision: 'PENDING' },
                data: { decision },
            });
            if (claimed.count === 0) throw new AlreadyAnsweredError();
            if (choice === 'KEEP') return;

            const deleted = choice === 'DROP' && key ? [...easyIds, key.id] : easyIds;
            if (deleted.length > 0) {
                await tx.plannedSession.deleteMany({ where: { id: { in: deleted }, status: 'PLANNED' } });
            }
            if (downgraded && key) {
                await tx.plannedSession.update({
                    where: { id: key.id },
                    data: {
                        body: toJson(downgraded.body),
                        plannedLoad: downgraded.plannedLoad,
                    },
                });
            }
        });
    } catch (e) {
        if (e instanceof AlreadyAnsweredError) return { kind: 'no-ask' };
        throw e;
    }
    return { kind: 'answered', decision };
}

/**
 * A placement ask (story 60): the key session is already left out. A drop records it; a rewrite fails
 * the week and its request, so the athlete retries it like any failed week.
 */
async function answerPlacement(
    weekId: string,
    aiRequestId: string | null,
    choice: DecisionOption,
): Promise<DecisionOutcome> {
    const rewrite = choice === 'REWRITE';
    try {
        await db.$transaction(async (tx) => {
            const claimed = await tx.planWeek.updateMany({
                where: { id: weekId, decision: 'PENDING' },
                data: rewrite
                    ? { decision: null, generation: 'FAILED', conflict: Prisma.DbNull }
                    : { decision: 'DROPPED' },
            });
            if (claimed.count === 0) throw new AlreadyAnsweredError();
            if (!rewrite) return;
            await tx.plannedSession.deleteMany({ where: { planWeekId: weekId, status: 'PLANNED' } });
            if (aiRequestId) {
                await tx.aiRequest.update({
                    where: { id: aiRequestId },
                    data: { status: 'FAILED', error: 'The athlete asked for a rewrite' },
                });
            }
        });
    } catch (e) {
        if (e instanceof AlreadyAnsweredError) return { kind: 'no-ask' };
        throw e;
    }
    return rewrite ? { kind: 'rewrite' } : { kind: 'answered', decision: 'DROPPED' };
}
