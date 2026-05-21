import { error } from '@sveltejs/kit';
import { to } from 'await-to-js';
import {
    getAthleteProfile,
    getMonthlyWeeklyReportCount,
    getRunningGoals,
    getWeeklyReports,
} from '$lib/prisma/prisma';

export async function load({ locals }) {
    const userId = locals.user?.id;
    if (!userId) throw error(401, 'Unauthorized');

    const [err, results] = await to(
        Promise.all([
            getWeeklyReports(userId),
            getMonthlyWeeklyReportCount(userId),
            getAthleteProfile(userId),
            getRunningGoals(userId, { includeArchived: false }),
        ]),
    );
    if (err || !results) throw error(500, 'Cannot load reports');
    const [reports, monthlyReportCount, profile, goals] = results;

    return {
        reports: reports.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
        })),
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
