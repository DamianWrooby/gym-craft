import { to } from 'await-to-js';
import { mapGarminActivities } from './activity-mapper';
import { isInvalidTokenMessage } from '$lib/garmin/invalid-token';
import { garminApiUrl, garminBearerHeaders } from './config';
import { withGarminSession, type GarminAttemptErrorCode, type GarminAttemptResult } from './with-garmin-session';
import type { GarminActivity, GarminActivityRaw } from '@/models/garmin/activity.model';

export interface FetchGarminActivitiesParams {
    userId: string;
    startDate: string;
    endDate?: string;
    activityType?: string;
}

export type FetchGarminActivitiesErrorCode = GarminAttemptErrorCode;

export type FetchGarminActivitiesResult =
    | { ok: true; activities: GarminActivity[] }
    | { ok: false; status: number; code: FetchGarminActivitiesErrorCode; message: string };

/**
 * Fetches a date range of Garmin activities. Session handling — including silently renewing an
 * expired one and retrying once — belongs to `withGarminSession`, so this only describes the call.
 */
export async function fetchGarminActivities(params: FetchGarminActivitiesParams): Promise<FetchGarminActivitiesResult> {
    const { userId, startDate, endDate, activityType } = params;

    const requestBody: Record<string, string> = { startDate };
    if (endDate) requestBody.endDate = endDate;
    if (activityType) requestBody.activityType = activityType;

    const result = await withGarminSession(userId, (sessionToken) => requestActivities(sessionToken, requestBody));
    if (!result.ok) return result;

    return { ok: true, activities: mapGarminActivities(result.value) };
}

async function requestActivities(
    sessionToken: string,
    requestBody: Record<string, string>,
): Promise<GarminAttemptResult<GarminActivityRaw[]>> {
    const [fetchError, pyResponse] = await to(
        fetch(`${garminApiUrl}/activities`, {
            method: 'POST',
            headers: garminBearerHeaders(sessionToken),
            body: JSON.stringify(requestBody),
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
        return {
            ok: false,
            status: pyResponse.status,
            code: classifyGarminStatus(pyResponse.status, data, message),
            message,
        };
    }

    return { ok: true, value: Array.isArray(data?.data) ? data.data : [] };
}

/**
 * A 429 must stay distinguishable from a 401. Reading a Garmin throttle as an expired session sends
 * the athlete to a password prompt whose cold login is the most throttled path there is.
 */
export function classifyGarminStatus(
    status: number,
    payload: { code?: string } | null,
    message: string,
): GarminAttemptErrorCode {
    if (status === 429 || payload?.code === 'RATE_LIMITED') return 'RATE_LIMITED';
    if (status === 401 || isInvalidTokenMessage(message)) return 'INVALID_TOKEN';
    return 'GARMIN_SERVICE_ERROR';
}
