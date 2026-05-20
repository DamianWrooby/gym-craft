import { db } from '$lib/database';
import { fetchGarminActivities } from './fetch-activities';
import { toIsoDate } from '$lib/utils/iso-week';
import type { GarminActivity } from '@/models/garmin/activity.model';
import type { Prisma } from '@prisma/client';

const BACKFILL_DAYS = 90;
const INCREMENTAL_WINDOW_DAYS = 7;
const INCREMENTAL_MIN_WINDOW_DAYS = 2;

export type SyncResult =
    | { ok: true; mode: 'backfill' | 'incremental' | 'skipped'; activitiesUpserted: number; lastSyncedAt: Date }
    | { ok: false; status: number; code: string; message: string };

export async function syncUserActivities(userId: string, password?: string): Promise<SyncResult> {
    const state = await db.garminSyncState.findUnique({ where: { userId } });
    if (!state || !state.backfillComplete) {
        return runBackfill(userId, password);
    }
    return runIncremental(userId, state.lastSyncedAt, password);
}

export async function backfillUser(userId: string, password?: string): Promise<SyncResult> {
    return runBackfill(userId, password);
}

export async function incrementalSync(userId: string, password?: string): Promise<SyncResult> {
    const state = await db.garminSyncState.findUnique({ where: { userId } });
    if (!state || !state.backfillComplete) {
        return runBackfill(userId, password);
    }
    return runIncremental(userId, state.lastSyncedAt, password);
}

async function runBackfill(userId: string, password?: string): Promise<SyncResult> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - BACKFILL_DAYS);

    const result = await fetchGarminActivities({
        userId,
        startDate: toIsoDate(startDate),
        endDate: toIsoDate(endDate),
        password,
    });
    if (!result.ok) {
        return { ok: false, status: result.status, code: result.code, message: result.message };
    }

    const upserted = await upsertActivities(userId, result.activities);
    const oldestActivityAt = findOldestStartTime(result.activities);
    const now = new Date();

    await db.garminSyncState.upsert({
        where: { userId },
        create: {
            userId,
            lastSyncedAt: now,
            oldestActivityAt: oldestActivityAt ?? startDate,
            backfillComplete: true,
        },
        update: {
            lastSyncedAt: now,
            oldestActivityAt: oldestActivityAt ?? startDate,
            backfillComplete: true,
        },
    });

    return { ok: true, mode: 'backfill', activitiesUpserted: upserted, lastSyncedAt: now };
}

async function runIncremental(userId: string, lastSyncedAt: Date | null, password?: string): Promise<SyncResult> {
    const endDate = new Date();
    const startDate = pickIncrementalStart(lastSyncedAt, endDate);

    const result = await fetchGarminActivities({
        userId,
        startDate: toIsoDate(startDate),
        endDate: toIsoDate(endDate),
        password,
    });
    if (!result.ok) {
        return { ok: false, status: result.status, code: result.code, message: result.message };
    }

    const upserted = await upsertActivities(userId, result.activities);
    const now = new Date();

    await db.garminSyncState.update({
        where: { userId },
        data: { lastSyncedAt: now },
    });

    return { ok: true, mode: 'incremental', activitiesUpserted: upserted, lastSyncedAt: now };
}

function pickIncrementalStart(lastSyncedAt: Date | null, endDate: Date): Date {
    const minStart = new Date(endDate);
    minStart.setUTCDate(minStart.getUTCDate() - INCREMENTAL_MIN_WINDOW_DAYS);

    if (!lastSyncedAt) {
        const fallback = new Date(endDate);
        fallback.setUTCDate(fallback.getUTCDate() - INCREMENTAL_WINDOW_DAYS);
        return fallback;
    }

    const guardedStart = new Date(lastSyncedAt);
    guardedStart.setUTCDate(guardedStart.getUTCDate() - 1);

    return guardedStart < minStart ? guardedStart : minStart;
}

async function upsertActivities(userId: string, activities: GarminActivity[]): Promise<number> {
    if (activities.length === 0) return 0;

    const rows = activities.map((activity) => toRow(userId, activity));

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
                update: row,
            }),
        ),
    );

    return results.length;
}

function toRow(userId: string, activity: GarminActivity) {
    const startTime = parseGarminStartTime(activity);
    const raw = activity as unknown as Prisma.InputJsonValue;

    return {
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
        trimpLoad: null,
        raw,
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
