import { db } from '$lib/database';
import { isRunningTypeKey } from '$lib/utils/activity-type';
import { edwardsTrimp, zoneSecondsFromSamples, type HrSample } from '$lib/server/analytics/load/trimp';
import { isValidZones, type HrZoneBound } from '$lib/planner/core/zones';

/** Runs inside this window are scored against the athlete's zones; older history keeps Garmin's. */
export const RESCORE_WINDOW_DAYS = 42;
export interface RebinResult {
    scored: number;
    /** Garmin IDs of window runs with no stored samples; the browser fetches their detail via the proxy. */
    needsDetail: string[];
}

/**
 * Re-bins every run in the window still flagged `GARMIN_ZONES` against the athlete's own zones,
 * from stored samples only: no Garmin call, so it is safe inside a time-limited function. Runs
 * without stored samples are returned for the browser to fetch (ADR 0027). A run that cannot be
 * scored keeps Garmin's load and its flag, so the next sync retries it.
 */
export async function rebinRunsAfterSync(userId: string, now = new Date()): Promise<RebinResult> {
    const zones = await profileZones(userId);
    if (!zones) return { scored: 0, needsDetail: [] };

    const candidates = await db.activity.findMany({
        where: { userId, zoneSource: 'GARMIN_ZONES', startTime: { gte: windowStart(now) } },
        orderBy: { startTime: 'desc' },
        select: { id: true, garminActivityId: true, activityType: true, detail: { select: { samples: true } } },
    });

    const result: RebinResult = { scored: 0, needsDetail: [] };
    for (const run of candidates) {
        if (!isRunningTypeKey(run.activityType)) continue;
        if (!run.detail) {
            result.needsDetail.push(run.garminActivityId.toString());
            continue;
        }
        if (await scoreFromSamples(run.id, run.detail.samples as unknown as HrSample[], zones)) result.scored++;
    }
    return result;
}

/**
 * Scores one run from freshly stored samples against the profile zones. Returns false (run keeps
 * Garmin's load and flag) when the athlete has no confirmed zones or the samples carry no HR.
 */
export async function scoreRunFromSamples(userId: string, activityId: string, samples: HrSample[]): Promise<boolean> {
    const zones = await profileZones(userId);
    if (!zones) return false;
    return scoreFromSamples(activityId, samples, zones);
}

/**
 * After a zone change: re-scores the window's runs from stored samples only (no Garmin call).
 * Frozen recovery budgets on plan weeks are never touched. Returns the number re-scored.
 */
export async function rescoreRunsForZoneChange(
    userId: string,
    zones: HrZoneBound[],
    now = new Date(),
): Promise<number> {
    const runs = await db.activity.findMany({
        where: { userId, startTime: { gte: windowStart(now) }, detail: { isNot: null } },
        select: { id: true, activityType: true, detail: { select: { samples: true } } },
    });

    let scored = 0;
    for (const run of runs) {
        if (!isRunningTypeKey(run.activityType) || !run.detail) continue;
        if (await scoreFromSamples(run.id, run.detail.samples as unknown as HrSample[], zones)) scored++;
    }
    return scored;
}

/** Zone-change trigger for profile and plan writes. Best effort: a failure never fails the write. */
export async function rescoreIfZonesChanged(userId: string, previous: unknown, next: unknown): Promise<void> {
    if (!isValidZones(next) || JSON.stringify(previous) === JSON.stringify(next)) return;
    try {
        await rescoreRunsForZoneChange(userId, next);
    } catch (e) {
        console.error('Re-scoring runs after a zone change failed', e);
    }
}

async function scoreFromSamples(activityId: string, samples: HrSample[], zones: HrZoneBound[]): Promise<boolean> {
    const zoneSeconds = zoneSecondsFromSamples(samples, zones);
    if (!zoneSeconds) return false;
    await db.activity.update({
        where: { id: activityId },
        data: { trimpLoad: edwardsTrimp(zoneSeconds), loadMethod: 'EDWARDS', zoneSource: 'ATHLETE_ZONES' },
    });
    return true;
}

async function profileZones(userId: string): Promise<HrZoneBound[] | null> {
    const profile = await db.athleteProfile.findUnique({ where: { userId }, select: { hrZoneBounds: true } });
    const bounds = profile?.hrZoneBounds;
    return isValidZones(bounds) ? bounds : null;
}

function windowStart(now: Date): Date {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - RESCORE_WINDOW_DAYS);
    return start;
}
