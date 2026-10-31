import { redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import { activityListSelect, toActivityListItem, type ActivityListItem } from '$lib/server/garmin/activity-row-mapper';
import { ACTIVITY_MAX_SHOWN, ACTIVITY_PAGE_SIZE, resolveActivityListQuery } from '$lib/utils/activity-list-query';

export interface ActivityListPageData {
    activities: ActivityListItem[];
    /** Total rows matching the window, so the UI can say "20 of 143". */
    total: number;
    /** Inclusive window start (`yyyy-mm-dd`), echoed back for the filter inputs. */
    from: string;
    /** Inclusive window end (`yyyy-mm-dd`). */
    to: string;
    /** How many rows this response was asked to reveal. */
    shown: number;
    pageSize: number;
    /** Whether another batch exists below the ones returned. */
    hasMore: boolean;
    /** `hasMore` is true but `shown` is at the ceiling — the user must narrow the window. */
    atMaxShown: boolean;
    lastSyncedAt: string | null;
}

export const load = async ({ locals, url }: { locals: App.Locals; url: URL }): Promise<ActivityListPageData> => {
    const userId = locals.user?.id;
    if (!userId) redirect(302, '/app/login');

    const { from, to, shown, rangeStart, rangeEnd } = resolveActivityListQuery(url.searchParams);
    const where = { userId, startTime: { gte: rangeStart, lte: rangeEnd } };

    const [rows, total, syncState] = await Promise.all([
        db.activity.findMany({
            where,
            orderBy: { startTime: 'desc' },
            select: activityListSelect,
            take: shown,
        }),
        db.activity.count({ where }),
        db.garminSyncState.findUnique({ where: { userId } }),
    ]);

    const hasMore = total > rows.length;

    return {
        activities: rows.map(toActivityListItem),
        total,
        from,
        to,
        shown,
        pageSize: ACTIVITY_PAGE_SIZE,
        hasMore,
        atMaxShown: hasMore && shown >= ACTIVITY_MAX_SHOWN,
        lastSyncedAt: syncState?.lastSyncedAt ? syncState.lastSyncedAt.toISOString() : null,
    };
};
