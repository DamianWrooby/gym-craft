import { db } from '$lib/database';
import { fetchGarminActivities } from './fetch-activities';
import { toIsoDate } from '$lib/utils/iso-week';
import { pickIncrementalStart, type SyncMode } from '$lib/garmin/sync-window';
import { mapProfileSex, scoreTrimp, trimpModality, type TrimpProfile } from '$lib/server/analytics/load/trimp';
import { rebinRunsAfterSync } from './score-runs';
import { linkSyncedActivities } from '$lib/server/planner/link';
import { hrZoneSecondsFromRow } from '$lib/utils/hr-zones';
import type { GarminActivity } from '@/models/garmin/activity.model';
import type { Prisma, ZoneSource } from '@prisma/client';

export type SyncResult =
    | {
          ok: true;
          mode: 'backfill' | 'incremental' | 'skipped';
          activitiesUpserted: number;
          lastSyncedAt: Date;
          /** Garmin IDs of runs still on Garmin's zones with no stored samples (ADR 0027). */
          runsNeedingDetail: string[];
      }
    | { ok: false; status: number; code: string; message: string };

export async function syncUserActivities(userId: string, backfillDays: number): Promise<SyncResult> {
    const state = await db.garminSyncState.findUnique({ where: { userId } });
    if (!state || !state.backfillComplete) {
        return runBackfill(userId, backfillDays);
    }
    return runIncremental(userId, state.lastSyncedAt);
}

export async function backfillUser(userId: string, backfillDays: number): Promise<SyncResult> {
    return runBackfill(userId, backfillDays);
}

export async function incrementalSync(userId: string, backfillDays: number): Promise<SyncResult> {
    const state = await db.garminSyncState.findUnique({ where: { userId } });
    if (!state || !state.backfillComplete) {
        return runBackfill(userId, backfillDays);
    }
    return runIncremental(userId, state.lastSyncedAt);
}

async function runBackfill(userId: string, backfillDays: number): Promise<SyncResult> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - backfillDays);

    const result = await fetchGarminActivities({
        userId,
        startDate: toIsoDate(startDate),
        endDate: toIsoDate(endDate),
    });
    if (!result.ok) {
        return { ok: false, status: result.status, code: result.code, message: result.message };
    }

    return persistActivities(userId, result.activities, 'backfill', backfillDays);
}

async function runIncremental(userId: string, lastSyncedAt: Date | null): Promise<SyncResult> {
    const endDate = new Date();
    const startDate = pickIncrementalStart(lastSyncedAt, endDate);

    const result = await fetchGarminActivities({
        userId,
        startDate: toIsoDate(startDate),
        endDate: toIsoDate(endDate),
    });
    if (!result.ok) {
        return { ok: false, status: result.status, code: result.code, message: result.message };
    }

    return persistActivities(userId, result.activities, 'incremental', 0);
}

/**
 * Persist already-fetched activities and advance the sync state. Shared by the server-side
 * fetch path (`runBackfill`/`runIncremental`, used by the weekly-report endpoint) and the
 * proxy-driven path where the browser fetched the activities and posts them to be saved.
 *
 * Backfill upserts the sync state (marking it complete + recording the oldest activity);
 * incremental only advances `lastSyncedAt` (the state row is guaranteed to exist by then).
 */
export async function persistActivities(
    userId: string,
    activities: GarminActivity[],
    mode: SyncMode,
    backfillDays: number,
): Promise<SyncResult> {
    const { upserted, createdIds } = await upsertActivities(userId, activities);
    const runsNeedingDetail = await rebinRuns(userId);
    await linkNewActivities(userId, createdIds);
    const now = new Date();

    if (mode === 'backfill') {
        const fallbackOldest = new Date(now);
        fallbackOldest.setUTCDate(fallbackOldest.getUTCDate() - backfillDays);
        const oldestActivityAt = findOldestStartTime(activities) ?? fallbackOldest;

        await db.garminSyncState.upsert({
            where: { userId },
            create: { userId, lastSyncedAt: now, oldestActivityAt, backfillComplete: true },
            update: { lastSyncedAt: now, oldestActivityAt, backfillComplete: true },
        });

        return { ok: true, mode: 'backfill', activitiesUpserted: upserted, lastSyncedAt: now, runsNeedingDetail };
    }

    await db.garminSyncState.update({
        where: { userId },
        data: { lastSyncedAt: now },
    });

    return { ok: true, mode: 'incremental', activitiesUpserted: upserted, lastSyncedAt: now, runsNeedingDetail };
}

async function upsertActivities(
    userId: string,
    activities: GarminActivity[],
): Promise<{ upserted: number; createdIds: string[] }> {
    if (activities.length === 0) return { upserted: 0, createdIds: [] };

    const profile = await db.athleteProfile.findUnique({
        where: { userId },
        select: { restingHR: true, maxHR: true, sex: true },
    });
    const trimpProfile: TrimpProfile = {
        restingHR: profile?.restingHR ?? null,
        maxHR: profile?.maxHR ?? null,
        sex: profile ? mapProfileSex(profile.sex) : null,
    };

    const rows = activities.map((activity) => toRow(userId, activity, trimpProfile));
    const existing = await findExisting(userId, rows);

    const results = await db.$transaction(
        rows.map((row) =>
            db.activity.upsert({
                where: {
                    userId_garminActivityId: {
                        userId: row.userId,
                        garminActivityId: row.garminActivityId,
                    },
                },
                create: row,
                update: existing.get(row.garminActivityId) === 'ATHLETE_ZONES' ? withoutLoad(row) : row,
            }),
        ),
    );

    const createdIds = results.filter((r) => !existing.has(r.garminActivityId)).map((r) => r.id);
    return { upserted: results.length, createdIds };
}

/**
 * Links only activities new to this sync: a re-synced activity the athlete unlinked stays
 * unlinked. Best effort, like re-binning: a failure never fails the sync.
 */
async function linkNewActivities(userId: string, createdIds: string[]): Promise<void> {
    try {
        await linkSyncedActivities(userId, createdIds);
    } catch (e) {
        console.error('Linking synced activities to planned sessions failed', e);
    }
}

/** Re-binning is best effort: a failure leaves the flag set and never fails the sync. */
async function rebinRuns(userId: string): Promise<string[]> {
    try {
        return (await rebinRunsAfterSync(userId)).needsDetail;
    } catch (e) {
        console.error('Re-binning runs failed; the next sync retries', e);
        return [];
    }
}

/**
 * Rows already stored, with their zone source. A sync must not overwrite a run already scored
 * against the athlete's zones with Garmin's load.
 */
async function findExisting(
    userId: string,
    rows: { garminActivityId: bigint }[],
): Promise<Map<bigint, ZoneSource | null>> {
    const existing = await db.activity.findMany({
        where: { userId, garminActivityId: { in: rows.map((r) => r.garminActivityId) } },
        select: { garminActivityId: true, zoneSource: true },
    });
    return new Map(existing.map((e) => [e.garminActivityId, e.zoneSource]));
}

function withoutLoad<T extends { trimpLoad: unknown; loadMethod: unknown; zoneSource: unknown }>(row: T) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { trimpLoad, loadMethod, zoneSource, ...rest } = row;
    return rest;
}

function toRow(userId: string, activity: GarminActivity, profile: TrimpProfile) {
    const startTime = parseGarminStartTime(activity);
    const raw = activity as unknown as Prisma.InputJsonValue;

    const row = {
        userId,
        garminActivityId: BigInt(activity.activityId),
        activityType: activity.activityType.typeKey,
        activityName: activity.activityName ?? null,
        startTime,
        durationSec: Math.round(activity.duration ?? 0),
        movingDurationSec: activity.movingDuration != null ? Math.round(activity.movingDuration) : null,
        distanceM: activity.distance ?? null,
        calories: activity.calories != null ? Math.round(activity.calories) : null,
        averageHr: activity.averageHR != null ? Math.round(activity.averageHR) : null,
        maxHr: activity.maxHR != null ? Math.round(activity.maxHR) : null,
        hrZone1Sec: activity.hrZones?.zone1 != null ? Math.round(activity.hrZones.zone1) : null,
        hrZone2Sec: activity.hrZones?.zone2 != null ? Math.round(activity.hrZones.zone2) : null,
        hrZone3Sec: activity.hrZones?.zone3 != null ? Math.round(activity.hrZones.zone3) : null,
        hrZone4Sec: activity.hrZones?.zone4 != null ? Math.round(activity.hrZones.zone4) : null,
        hrZone5Sec: activity.hrZones?.zone5 != null ? Math.round(activity.hrZones.zone5) : null,
        moderateMinutes:
            activity.moderateIntensityMinutes != null ? Math.round(activity.moderateIntensityMinutes) : null,
        vigorousMinutes:
            activity.vigorousIntensityMinutes != null ? Math.round(activity.vigorousIntensityMinutes) : null,
        averageSpeed: activity.averageSpeed ?? null,
        maxSpeed: activity.maxSpeed ?? null,
        averageCadence: activity.averageCadence ?? null,
        maxCadence: activity.maxCadence ?? null,
        avgStrideLength: activity.avgStrideLength ?? null,
        elevationGainM: activity.elevationGain ?? null,
        elevationLossM: activity.elevationLoss ?? null,
        raw,
    };

    // Computed at write time so a synced row always carries a load; re-syncs recompute
    // deterministically from the same inputs (and pick up profile changes). A run starts on
    // Garmin's zones; `rebinRunsAfterSync` then re-scores it against the athlete's.
    const modality = trimpModality(row.activityType);
    const score = scoreTrimp({
        durationSec: row.durationSec,
        hrZoneSeconds: hrZoneSecondsFromRow(row),
        averageHr: row.averageHr,
        restingHr: profile.restingHR,
        maxHr: profile.maxHR,
        sex: profile.sex ?? 'male',
        modality,
    });
    return {
        ...row,
        trimpLoad: score.load,
        loadMethod: score.method,
        zoneSource: modality === 'running' ? ('GARMIN_ZONES' as const) : null,
    };
}

function parseGarminStartTime(activity: GarminActivity): Date {
    if (activity.beginTimestamp) {
        return new Date(activity.beginTimestamp);
    }
    if (activity.startTimeGMT) {
        const normalized = activity.startTimeGMT.includes('T')
            ? activity.startTimeGMT
            : activity.startTimeGMT.replace(' ', 'T') + 'Z';
        const parsed = new Date(normalized);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date(activity.startTimeLocal);
}

function findOldestStartTime(activities: GarminActivity[]): Date | null {
    if (activities.length === 0) return null;
    let oldest: Date | null = null;
    for (const activity of activities) {
        const candidate = parseGarminStartTime(activity);
        if (!oldest || candidate < oldest) oldest = candidate;
    }
    return oldest;
}
