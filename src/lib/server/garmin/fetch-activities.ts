import { to } from 'await-to-js';
import { getGarminEmail } from '$lib/prisma/prisma';
import { mapGarminActivities } from './activity-mapper';
import { garminApiUrl, garminApiHeaders } from './config';
import type { GarminActivity, GarminActivityRaw } from '@/models/garmin/activity.model';

export interface FetchGarminActivitiesParams {
    userId: string;
    startDate: string;
    endDate?: string;
    activityType?: string;
    password?: string;
}

export type FetchGarminActivitiesResult =
    | { ok: true; activities: GarminActivity[] }
    | { ok: false; status: number; code: FetchGarminActivitiesErrorCode; message: string };

export type FetchGarminActivitiesErrorCode =
    | 'GARMIN_EMAIL_NOT_CONFIGURED'
    | 'GARMIN_SERVICE_UNREACHABLE'
    | 'GARMIN_SERVICE_PARSE_ERROR'
    | 'INVALID_TOKEN'
    | 'GARMIN_SERVICE_ERROR';

export async function fetchGarminActivities(params: FetchGarminActivitiesParams): Promise<FetchGarminActivitiesResult> {
    const { userId, startDate, endDate, activityType, password } = params;

    const [emailError, email] = await to(getGarminEmail(userId));
    if (emailError || !email) {
        return {
            ok: false,
            status: 400,
            code: 'GARMIN_EMAIL_NOT_CONFIGURED',
            message: 'Garmin email not configured',
        };
    }

    const requestBody: Record<string, string> = { username: String(email), startDate };
    if (password) requestBody.password = password;
    if (endDate) requestBody.endDate = endDate;
    if (activityType) requestBody.activityType = activityType;

    const url = `${garminApiUrl}/activities`;

    const [fetchError, pyResponse] = await to(
        fetch(url, {
            method: 'POST',
            headers: garminApiHeaders(),
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
        const code: FetchGarminActivitiesErrorCode = message.includes('No valid token found')
            ? 'INVALID_TOKEN'
            : 'GARMIN_SERVICE_ERROR';
        return { ok: false, status: pyResponse.status, code, message };
    }

    const rawList: GarminActivityRaw[] = Array.isArray(data?.data) ? data.data : [];
    return { ok: true, activities: mapGarminActivities(rawList) };
}
