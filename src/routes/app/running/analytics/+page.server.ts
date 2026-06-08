import { redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import { getWeeklyReports } from '$lib/prisma/prisma';
import { toActivityListItem, type ActivityListItem } from '$lib/server/garmin/activity-row-mapper';
import { computeDashboardSummary, type DashboardSummary } from '$lib/server/analytics/load/dashboard-summary';

export interface DashboardReportPreview {
    id: string;
    periodStart: string;
    periodEnd: string;
    summary: string;
    createdAt: string;
}

export interface DashboardPageData {
    summary: DashboardSummary;
    recentActivities: ActivityListItem[];
    recentReports: DashboardReportPreview[];
    lastSyncedAt: string | null;
    needsInitialSync: boolean;
    garminEmail: string | null;
}

export const load = async ({ locals }: { locals: App.Locals }): Promise<DashboardPageData> => {
    const userId = locals.user?.id;
    if (!userId) throw redirect(302, '/app/login');

    const [rows, syncState, garminData, reports] = await Promise.all([
        db.activity.findMany({ where: { userId }, orderBy: { startTime: 'desc' } }),
        db.garminSyncState.findUnique({ where: { userId } }),
        db.garminData.findUnique({ where: { userId }, select: { email: true } }),
        getWeeklyReports(userId),
    ]);

    const activities = rows.map(toActivityListItem);
    const summary = computeDashboardSummary(
        activities.map((a) => ({ startTime: a.startTime, distanceM: a.distanceM, trimpLoad: a.trimpLoad })),
        new Date(),
    );

    return {
        summary,
        recentActivities: activities.slice(0, 5),
        recentReports: reports.slice(0, 3).map((r) => ({
            id: r.id,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            summary: r.summary,
            createdAt: r.createdAt.toISOString(),
        })),
        lastSyncedAt: syncState?.lastSyncedAt ? syncState.lastSyncedAt.toISOString() : null,
        needsInitialSync: !syncState?.backfillComplete,
        garminEmail: garminData?.email ?? null,
    };
};
