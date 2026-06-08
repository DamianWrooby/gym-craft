import { db } from '$lib/database';
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }: { locals: App.Locals }) => {
    const userId = locals.user?.id;
    if (!userId) throw redirect(302, '/app/login');

    const [garminData, syncState] = await Promise.all([
        db.garminData.findUnique({ where: { userId }, select: { id: true, email: true } }),
        db.garminSyncState.findUnique({
            where: { userId },
            select: { backfillComplete: true, lastSyncedAt: true, oldestActivityAt: true },
        }),
    ]);

    return {
        garminConnected: garminData != null,
        garminEmail: garminData?.email ?? null,
        syncState: syncState
            ? {
                  backfillComplete: syncState.backfillComplete,
                  lastSyncedAt: syncState.lastSyncedAt?.toISOString() ?? null,
                  oldestActivityAt: syncState.oldestActivityAt?.toISOString() ?? null,
              }
            : null,
    };
};
