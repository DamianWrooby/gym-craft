import { to } from 'await-to-js';
import { garminApiUrl, garminBearerHeaders } from './config';
import { classifyGarminStatus } from './fetch-activities';
import { withGarminSession, type GarminAttemptErrorCode, type GarminAttemptResult } from './with-garmin-session';

export interface ActivitySplit {
    splitIndex: number;
    distanceM: number;
    durationSec: number;
    averageHr: number | null;
    averageSpeed: number | null;
    elevationGainM: number | null;
    elevationLossM: number | null;
}

export interface ActivitySample {
    timestampSec: number;
    heartRate: number | null;
    speed: number | null;
    elevationM: number | null;
    cadence: number | null;
    power: number | null;
}

export interface RoutePoint {
    lat: number;
    lng: number;
}

export interface ActivityDynamics {
    avgCadence: number | null;
    maxCadence: number | null;
    avgGroundContactTimeMs: number | null;
    avgVerticalOscillationCm: number | null;
    avgVerticalRatioPct: number | null;
    avgPowerW: number | null;
    maxPowerW: number | null;
    minTemperatureC: number | null;
    maxTemperatureC: number | null;
}

export interface ActivityDetailPayload {
    activityId: number;
    activityName: string | null;
    activityType: string;
    startTimeGMT: string | null;
    duration: number | null;
    distance: number | null;
    splits: ActivitySplit[];
    samples: ActivitySample[];
    route: RoutePoint[];
    dynamics: ActivityDynamics | null;
}

export type FetchActivityDetailErrorCode = GarminAttemptErrorCode;

export type FetchActivityDetailResult =
    | { ok: true; detail: ActivityDetailPayload }
    | { ok: false; status: number; code: FetchActivityDetailErrorCode; message: string };

export interface FetchActivityDetailParams {
    userId: string;
    garminActivityId: bigint | number;
}

/**
 * Fetches one activity's splits + downsampled samples. Session handling — including silently
 * renewing an expired one and retrying once — belongs to `withGarminSession`.
 */
export async function fetchActivityDetail(params: FetchActivityDetailParams): Promise<FetchActivityDetailResult> {
    const { userId, garminActivityId } = params;

    const body: Record<string, unknown> = {
        activityId: typeof garminActivityId === 'bigint' ? Number(garminActivityId) : garminActivityId,
    };

    const result = await withGarminSession(userId, (sessionToken) => requestActivityDetail(sessionToken, body));
    if (!result.ok) return result;

    return { ok: true, detail: result.value };
}

async function requestActivityDetail(
    sessionToken: string,
    body: Record<string, unknown>,
): Promise<GarminAttemptResult<ActivityDetailPayload>> {
    const url = `${garminApiUrl}/activity/detail`;

    const [fetchError, pyResponse] = await to(
        fetch(url, {
            method: 'POST',
            headers: garminBearerHeaders(sessionToken),
            body: JSON.stringify(body),
        }),
    );

    if (fetchError || !pyResponse) {
        return {
            ok: false,
            status: 502,
            code: 'GARMIN_SERVICE_UNREACHABLE',
            message: fetchError?.message || 'Failed to reach Garmin service',
        };
    }

    const [parseError, data] = await to(pyResponse.json());
    if (parseError) {
        return {
            ok: false,
            status: 502,
            code: 'GARMIN_SERVICE_PARSE_ERROR',
            message: 'Invalid response from Garmin service',
        };
    }

    if (!pyResponse.ok) {
        const message: string = data?.message || 'Garmin service error';
        const code = classifyGarminStatus(pyResponse.status, data, message);
        return { ok: false, status: pyResponse.status, code, message };
    }

    const payload = data?.data;
    if (!payload) {
        return {
            ok: false,
            status: 502,
            code: 'GARMIN_SERVICE_PARSE_ERROR',
            message: 'Missing data field in Garmin service response',
        };
    }

    return { ok: true, value: normalizeDetail(payload) };
}

function normalizeDetail(payload: Record<string, unknown>): ActivityDetailPayload {
    const splits = Array.isArray(payload.splits)
        ? (payload.splits as Record<string, unknown>[]).map((s, i) => normalizeSplit(s, i))
        : [];
    const samples = Array.isArray(payload.samples)
        ? (payload.samples as Record<string, unknown>[]).map(normalizeSample)
        : [];

    return {
        activityId: numberOr(payload.activityId, 0),
        activityName: stringOrNull(payload.activityName),
        activityType: typeof payload.activityType === 'string' ? payload.activityType : 'unknown',
        startTimeGMT: stringOrNull(payload.startTimeGMT),
        duration: numberOrNull(payload.duration),
        distance: numberOrNull(payload.distance),
        splits,
        samples,
        route: normalizeRoute(payload),
        dynamics: normalizeDynamics(payload),
    };
}

function normalizeRoute(payload: Record<string, unknown>): RoutePoint[] {
    if (!Array.isArray(payload.route)) return [];
    return (payload.route as Record<string, unknown>[])
        .map((p) => ({ lat: numberOrNull(p.lat), lng: numberOrNull(p.lng) }))
        .filter((p): p is RoutePoint => p.lat !== null && p.lng !== null);
}

function normalizeDynamics(payload: Record<string, unknown>): ActivityDynamics | null {
    const d = payload.dynamics as Record<string, unknown> | null | undefined;
    if (!d || typeof d !== 'object') return null;
    const out: ActivityDynamics = {
        avgCadence: numberOrNull(d.avgCadence),
        maxCadence: numberOrNull(d.maxCadence),
        avgGroundContactTimeMs: numberOrNull(d.avgGroundContactTimeMs),
        avgVerticalOscillationCm: numberOrNull(d.avgVerticalOscillationCm),
        avgVerticalRatioPct: numberOrNull(d.avgVerticalRatioPct),
        avgPowerW: numberOrNull(d.avgPowerW),
        maxPowerW: numberOrNull(d.maxPowerW),
        minTemperatureC: numberOrNull(d.minTemperatureC),
        maxTemperatureC: numberOrNull(d.maxTemperatureC),
    };
    return Object.values(out).every((v) => v === null) ? null : out;
}

function normalizeSplit(split: Record<string, unknown>, fallbackIndex: number): ActivitySplit {
    return {
        splitIndex: numberOr(split.splitIndex, fallbackIndex),
        distanceM: numberOr(split.distanceM, 0),
        durationSec: numberOr(split.durationSec, 0),
        averageHr: numberOrNull(split.averageHr),
        averageSpeed: numberOrNull(split.averageSpeed),
        elevationGainM: numberOrNull(split.elevationGainM),
        elevationLossM: numberOrNull(split.elevationLossM),
    };
}

function normalizeSample(sample: Record<string, unknown>): ActivitySample {
    return {
        timestampSec: numberOr(sample.timestampSec, 0),
        heartRate: numberOrNull(sample.heartRate),
        speed: numberOrNull(sample.speed),
        elevationM: numberOrNull(sample.elevationM),
        cadence: numberOrNull(sample.cadence),
        power: numberOrNull(sample.power),
    };
}

function numberOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Test-only re-export so the normalizer can be unit-tested without a live fetch. */
export const normalizeDetailForTest = normalizeDetail;
