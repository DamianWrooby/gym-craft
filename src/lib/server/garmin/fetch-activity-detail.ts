import { to } from 'await-to-js';
import { getGarminEmail } from '$lib/prisma/prisma';
import { isInvalidTokenMessage } from '$lib/garmin/invalid-token';
import { garminApiUrl, garminApiHeaders } from './config';

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
}

export type FetchActivityDetailErrorCode =
    | 'GARMIN_EMAIL_NOT_CONFIGURED'
    | 'GARMIN_SERVICE_UNREACHABLE'
    | 'GARMIN_SERVICE_PARSE_ERROR'
    | 'INVALID_TOKEN'
    | 'GARMIN_SERVICE_ERROR';

export type FetchActivityDetailResult =
    | { ok: true; detail: ActivityDetailPayload }
    | { ok: false; status: number; code: FetchActivityDetailErrorCode; message: string };

export interface FetchActivityDetailParams {
    userId: string;
    garminActivityId: bigint | number;
    password?: string;
}

export async function fetchActivityDetail(params: FetchActivityDetailParams): Promise<FetchActivityDetailResult> {
    const { userId, garminActivityId, password } = params;

    const [emailError, email] = await to(getGarminEmail(userId));
    if (emailError || !email) {
        return {
            ok: false,
            status: 400,
            code: 'GARMIN_EMAIL_NOT_CONFIGURED',
            message: 'Garmin email not configured',
        };
    }

    const body: Record<string, unknown> = {
        username: String(email),
        activityId: typeof garminActivityId === 'bigint' ? Number(garminActivityId) : garminActivityId,
    };
    if (password) body.password = password;

    const url = `${garminApiUrl}/activity/detail`;

    const [fetchError, pyResponse] = await to(
        fetch(url, {
            method: 'POST',
            headers: garminApiHeaders(),
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
        const code: FetchActivityDetailErrorCode = isInvalidTokenMessage(message)
            ? 'INVALID_TOKEN'
            : 'GARMIN_SERVICE_ERROR';
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

    return { ok: true, detail: normalizeDetail(payload) };
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
    };
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
