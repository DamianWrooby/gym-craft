import { redirect } from '@sveltejs/kit';
import { toIsoDate, todayInTimezone } from '$lib/utils/iso-week';
import { ageFromBirthDate } from '$lib/utils/age';
import { isRunningTypeKey } from '$lib/utils/activity-type';
import { getAthleteProfile } from '$lib/prisma/prisma';
import { getActivePlan, getPlanningContext } from '$lib/server/planner/repository';
import { recentRunningVolume } from '$lib/server/planner/build-plan';
import { proposeZones } from '$lib/planner/core/zones';
import { hashSessionToken } from '$lib/server/session-token';
import { selectableGoals } from '$lib/planner/wizard';

export const load = async ({
    locals,
    cookies,
}: {
    locals: App.Locals;
    cookies: { get(name: string): string | undefined };
}) => {
    const userId = locals.user?.id;
    if (!userId) redirect(302, '/app/login');
    if (await getActivePlan(userId)) redirect(302, '/app/plan');

    const profile = await getAthleteProfile(userId);
    if (!profile) return { profileMissing: true as const };

    const today = todayInTimezone(profile.timezone);
    const session = cookies.get('session');
    const context = await getPlanningContext(userId, today);
    const runs = context.activities
        .filter((a) => isRunningTypeKey(a.activityType) && a.distanceM)
        .map((a) => ({
            id: a.id,
            date: toIsoDate(a.startTime),
            distanceM: a.distanceM!,
            durationSec: a.movingDurationSec ?? a.durationSec,
        }));
    const results = context.raceResults.map((r) => ({ ...r, date: toIsoDate(r.date) }));

    return {
        profileMissing: false as const,
        today,
        // Hashed, never the raw cookie: the browser hands it to the AI proxy for week 1.
        proxySession: session ? hashSessionToken(session) : null,
        goals: selectableGoals(
            context.goals.map((g) => ({
                id: g.id,
                goalType: g.goalType,
                name: g.targetEventName,
                date: g.targetEventDate ? toIsoDate(g.targetEventDate) : null,
                distanceM: g.targetDistanceM,
            })),
            today,
        ),
        // Every active goal, dated or not: they set a new goal's class and order.
        goalRanks: context.goals.map((g) => ({ goalType: g.goalType, priority: g.priority })),
        zoneProposal: proposeZones({
            existing: profile.hrZoneBounds,
            maxHR: profile.maxHR,
            age: ageFromBirthDate(profile.birthDate),
        }),
        recentVolume: recentRunningVolume(context.activities, today),
        raceResults: results.map(({ id, date, distanceM, timeSec }) => ({ id, date, distanceM, timeSec })),
        runs,
    };
};
