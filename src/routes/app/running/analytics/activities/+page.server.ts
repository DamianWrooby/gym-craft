import { redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import { activityListSelect, toActivityListItem, type ActivityListItem } from '$lib/server/garmin/activity-row-mapper';

export interface ActivityListPageData {
    activities: ActivityListItem[];
    lastSyncedAt: string | null;
}

export const load = async ({ locals }: { locals: App.Locals }): Promise<ActivityListPageData> => {
    const userId = locals.user?.id;
    if (!userId) redirect(302, '/app/login');

    const [rows, syncState] = await Promise.all([
        db.activity.findMany({
            where: { userId },
            orderBy: { startTime: 'desc' },
            select: activityListSelect,
        }),
        db.garminSyncState.findUnique({ where: { userId } }),
    ]);

    return {
        activities: rows.map(toActivityListItem),
        lastSyncedAt: syncState?.lastSyncedAt ? syncState.lastSyncedAt.toISOString() : null,
    };
};
