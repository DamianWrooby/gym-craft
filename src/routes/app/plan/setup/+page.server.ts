import { redirect } from '@sveltejs/kit';
import { toIsoDate, todayInTimezone } from '$lib/utils/iso-week';
import { ageFromBirthDate } from '$lib/utils/age';
import { isRunningTypeKey } from '$lib/utils/activity-type';
import { getAthleteProfile } from '$lib/prisma/prisma';
import { getActivePlan, getPlanningContext } from '$lib/server/planner/repository';
import { recentRunningVolume } from '$lib/server/planner/build-plan';
import { proposeZones } from '$lib/planner/core/zones';

export const load = async ({ locals }: { locals: App.Locals }) => {
    const userId = locals.user?.id;
    if (!userId) redirect(302, '/app/login');
    if (await getActivePlan(userId)) redirect(302, '/app/plan');

    const profile = await getAthleteProfile(userId);
    if (!profile) return { profileMissing: true as const };

    const today = todayInTimezone(profile.timezone);
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
        goals: context.goals.map((g) => ({
            id: g.id,
            goalType: g.goalType,
            name: g.targetEventName,
            date: g.targetEventDate ? toIsoDate(g.targetEventDate) : null,
            distanceM: g.targetDistanceM,
        })),
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
