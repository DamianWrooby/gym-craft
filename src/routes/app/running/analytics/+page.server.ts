import { redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import { getWeeklyReports } from '$lib/prisma/prisma';
import { activityListSelect, toActivityListItem, type ActivityListItem } from '$lib/server/garmin/activity-row-mapper';
import { computeDashboardSummary, type DashboardSummary } from '$lib/server/analytics/load/dashboard-summary';
import { fillTrimpLoads } from '$lib/server/analytics/load/fill-trimp';
import { mapProfileSex } from '$lib/server/analytics/load/trimp';
import { ACUTE_DAYS, CHRONIC_DAYS } from '$lib/server/analytics/load/acwr';

/** Chronic load looks back 28 days; the extra acute week covers timezone edges at the boundary. */
const SUMMARY_WINDOW_DAYS = CHRONIC_DAYS + ACUTE_DAYS;
const RECENT_ACTIVITIES_LIMIT = 5;
const RECENT_REPORTS_LIMIT = 3;

export interface DashboardReportPreview {
    id: string;
    periodStart: string;
    periodEnd: string;
    summary: string;
    createdAt: string;
}

export interface DashboardPageData {
    /** Streamed: the load engine is the only expensive query on this page. */
    summary: Promise<DashboardSummary>;
    /** Streamed: node-cached, but a cold container still pays for it. */
    recentReports: Promise<DashboardReportPreview[]>;
    recentActivities: ActivityListItem[];
    lastSyncedAt: string | null;
    needsInitialSync: boolean;
    garminEmail: string | null;
    garminSessionToken: string | null;
}

async function buildSummary(userId: string, asOf: Date): Promise<DashboardSummary> {
    const windowStart = new Date(asOf);
    windowStart.setUTCDate(windowStart.getUTCDate() - SUMMARY_WINDOW_DAYS);

    const [windowRows, earliest, profile] = await Promise.all([
        db.activity.findMany({
            where: { userId, startTime: { gte: windowStart } },
            orderBy: { startTime: 'desc' },
            select: {
                startTime: true,
                distanceM: true,
                trimpLoad: true,
                durationSec: true,
                averageHr: true,
                hrZone1Sec: true,
                hrZone2Sec: true,
                hrZone3Sec: true,
                hrZone4Sec: true,
                hrZone5Sec: true,
            },
        }),
        // `hasSufficientHistory` asks how long the athlete has been training, which the
        // bounded window above cannot answer. An indexed _min is cheap and keeps the
        // flag meaning exactly what it meant when this page read every activity row.
        db.activity.aggregate({ where: { userId }, _min: { startTime: true } }),
        db.athleteProfile.findUnique({ where: { userId }, select: { restingHR: true, maxHR: true, sex: true } }),
    ]);

    const withTrimp = fillTrimpLoads(windowRows, {
        restingHR: profile?.restingHR ?? null,
        maxHR: profile?.maxHR ?? null,
        sex: profile ? mapProfileSex(profile.sex) : null,
    });

    return computeDashboardSummary(
        withTrimp.map((a) => ({
            startTime: a.startTime.toISOString(),
            distanceM: a.distanceM,
            trimpLoad: a.trimpLoad,
        })),
        asOf,
        earliest._min.startTime ?? null,
    );
}

async function buildRecentReports(userId: string): Promise<DashboardReportPreview[]> {
    const reports = await getWeeklyReports(userId);
    return reports.slice(0, RECENT_REPORTS_LIMIT).map((r) => ({
        id: r.id,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        summary: r.summary,
        createdAt: r.createdAt.toISOString(),
    }));
}

export const load = async ({ locals }: { locals: App.Locals }): Promise<DashboardPageData> => {
    const userId = locals.user?.id;
    if (!userId) redirect(302, '/app/login');

    // Started before the awaited block below so every query on this page runs
    // concurrently — these are returned unawaited and stream in behind skeletons.
    const summary = buildSummary(userId, new Date());
    const recentReports = buildRecentReports(userId);
    // SvelteKit only attaches its own rejection handler when it serialises these, and an
    // unhandled rejection in the gap can take down the invocation. A passive handler
    // marks them handled without altering what the component's {:catch} sees.
    summary.catch(() => {});
    recentReports.catch(() => {});

    // Awaited: the page's onMount reads the sync fields synchronously to decide whether
    // to kick off a Garmin sync, and the recent-activities list is a single indexed
    // lookup. Everything here is cheap, so the shell renders essentially complete.
    // Note this is a separate query from the summary window — an athlete who has not
    // trained in over 35 days should still see their last activities.
    const [recentRows, syncState, garminData] = await Promise.all([
        db.activity.findMany({
            where: { userId },
            orderBy: { startTime: 'desc' },
            take: RECENT_ACTIVITIES_LIMIT,
            select: activityListSelect,
        }),
        db.garminSyncState.findUnique({ where: { userId }, select: { lastSyncedAt: true, backfillComplete: true } }),
        db.garminData.findUnique({ where: { userId }, select: { email: true, sessionToken: true } }),
    ]);

    return {
        summary,
        recentReports,
        recentActivities: recentRows.map(toActivityListItem),
        lastSyncedAt: syncState?.lastSyncedAt ? syncState.lastSyncedAt.toISOString() : null,
        needsInitialSync: !syncState?.backfillComplete,
        garminEmail: garminData?.email ?? null,
        garminSessionToken: garminData?.sessionToken ?? null,
    };
};
