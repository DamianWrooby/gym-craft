import { error } from '@sveltejs/kit';
import { to } from 'await-to-js';
import {
    getAthleteProfile,
    getMonthlyWeeklyReportCount,
    getRunningGoals,
    getTimelineActivities,
    getWeeklyReports,
} from '$lib/prisma/prisma';
import { buildWeekTimeline, enumerateWeeks, TIMELINE_WEEKS } from '$lib/server/reports/week-timeline';
import { toIsoDate } from '$lib/utils/iso-week';

export async function load({ locals }) {
    const userId = locals.user?.id;
    if (!userId) error(401, 'Unauthorized');

    const asOf = toIsoDate(new Date());
    const weeks = enumerateWeeks(asOf, TIMELINE_WEEKS);
    const oldestMonday = weeks[weeks.length - 1].periodStart;

    const [err, results] = await to(
        Promise.all([
            getWeeklyReports(userId),
            getMonthlyWeeklyReportCount(userId),
            getAthleteProfile(userId),
            getRunningGoals(userId, { includeArchived: false }),
            getTimelineActivities(userId, new Date(`${oldestMonday}T00:00:00Z`)),
        ]),
    );
    if (err || !results) error(500, 'Cannot load reports');
    const [reports, monthlyReportCount, profile, goals, timelineActivities] = results;

    const timeline = buildWeekTimeline({ asOf, count: TIMELINE_WEEKS, reports, activities: timelineActivities });

    return {
        reports: reports.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
        })),
        timeline,
        monthlyReportCount,
        hasProfile: profile !== null,
        goals: goals.map((g) => ({
            ...g,
            targetEventDate: g.targetEventDate?.toISOString() ?? null,
            archivedAt: g.archivedAt?.toISOString() ?? null,
            createdAt: g.createdAt.toISOString(),
            updatedAt: g.updatedAt.toISOString(),
        })),
    };
}
