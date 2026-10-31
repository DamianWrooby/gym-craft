// Where the athlete stands in time: their local day, and the plan week that holds it.
import { db } from '$lib/database';
import { toIsoDate, todayInTimezone } from '$lib/utils/iso-week';

interface DatedWeek {
    startDate: Date;
    endDate: Date;
}

/** The athlete's timezone; UTC until the profile names one. */
export async function athleteTimezone(userId: string): Promise<string> {
    const profile = await db.athleteProfile.findUnique({ where: { userId }, select: { timezone: true } });
    return profile?.timezone ?? 'UTC';
}

export async function athleteToday(userId: string): Promise<string> {
    return todayInTimezone(await athleteTimezone(userId));
}

/** The week, and its phase, whose Monday–Sunday holds `today`. */
export function weekOn<P extends { weeks: DatedWeek[] }>(
    phases: P[],
    today: string,
): { phase: P; week: P['weeks'][number] } | null {
    for (const phase of phases) {
        for (const week of phase.weeks) {
            if (toIsoDate(week.startDate) <= today && toIsoDate(week.endDate) >= today) return { phase, week };
        }
    }
    return null;
}
