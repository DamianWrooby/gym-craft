import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    getAthleteProfile: vi.fn(),
    getRunningGoalsByIds: vi.fn(),
    getMonthlyWeeklyReportCount: vi.fn(),
    findExistingReport: vi.fn(),
    persistTrainingReport: vi.fn(),
    fetchGarminActivities: vi.fn(),
    callWeeklyReportProxy: vi.fn(),
    syncUserActivities: vi.fn(),
    computeLoadProfile: vi.fn(),
}));

vi.mock('$lib/prisma/prisma', () => ({
    getAthleteProfile: mocks.getAthleteProfile,
    getRunningGoalsByIds: mocks.getRunningGoalsByIds,
    getMonthlyWeeklyReportCount: mocks.getMonthlyWeeklyReportCount,
    findExistingReport: mocks.findExistingReport,
    persistTrainingReport: mocks.persistTrainingReport,
}));

vi.mock('$lib/server/garmin/fetch-activities', () => ({
    fetchGarminActivities: mocks.fetchGarminActivities,
}));

vi.mock('$lib/server/garmin/sync-activities', () => ({
    syncUserActivities: mocks.syncUserActivities,
}));

vi.mock('$lib/server/analytics/load', () => ({
    computeLoadProfile: mocks.computeLoadProfile,
}));

vi.mock('$lib/server/reports/call-proxy', () => ({
    callWeeklyReportProxy: mocks.callWeeklyReportProxy,
}));

import { POST } from './+server';
import { validateBody, validateDates } from '$lib/server/reports/weekly-validation';

const userId = 'user-1';
const locals = { user: { id: userId, subscriptionTier: 'FREE' } } as unknown as App.Locals;

const validBody = {
    periodStart: '2026-05-04', // Monday
    periodEnd: '2026-05-10', // Sunday
    goalIds: ['g1'],
    notes: 'Felt strong all week',
};

const profile = {
    id: 'profile-1',
    userId,
    birthDate: new Date('1989-08-19T00:00:00Z'),
    sex: 'MALE',
    weightKg: 80,
    heightCm: 180,
    timezone: 'UTC',
    restingHR: null,
    maxHR: null,
    hrZoneBounds: null,
    vo2max: null,
    updatedAt: new Date(),
};

const goal = {
    id: 'g1',
    userId,
    goalType: 'RACE',
    targetEventName: 'Berlin',
    targetEventDate: new Date('2026-09-27T00:00:00Z'),
    targetDistanceM: 42195,
    targetTimeSec: 13500,
    priority: 1,
    archivedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const activitySample = [
    {
        activityId: 1,
        activityName: 'Easy run',
        activityType: { typeKey: 'running' },
        startTimeLocal: '2026-05-05 09:00:00',
        startTimeGMT: '2026-05-05 07:00:00',
        beginTimestamp: 1746428400000,
        duration: 1800,
        distance: 5000,
        calories: 300,
        averageHR: 140,
    },
];

function makeRequest(body: unknown): Request {
    return new Request('http://test/api/user/user-1/reports/weekly', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

function defaultHappyPathMocks() {
    mocks.getAthleteProfile.mockResolvedValue(profile);
    mocks.getMonthlyWeeklyReportCount.mockResolvedValue(0);
    mocks.findExistingReport.mockResolvedValue(null);
    mocks.getRunningGoalsByIds.mockResolvedValue([goal]);
    mocks.fetchGarminActivities.mockResolvedValue({ ok: true, activities: activitySample });
    mocks.callWeeklyReportProxy.mockResolvedValue({ ok: true, summary: 'Great week!' });
    mocks.persistTrainingReport.mockResolvedValue({ id: 'report-1', userId, summary: 'Great week!' });
    mocks.syncUserActivities.mockResolvedValue({
        ok: true,
        mode: 'incremental',
        activitiesUpserted: 0,
        lastSyncedAt: new Date(),
    });
    mocks.computeLoadProfile.mockResolvedValue(null);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T12:00:00Z'));
    defaultHappyPathMocks();
});

afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
});

describe('POST /api/user/[id]/reports/weekly — auth and gating', () => {
    it('returns 403 when params.id mismatches the session user', async () => {
        const response = await POST({
            request: makeRequest(validBody),
            params: { id: 'someone-else' },
            locals,
        });
        expect(response.status).toBe(403);
        expect(mocks.fetchGarminActivities).not.toHaveBeenCalled();
    });

    it('passes the tier AI model to the report proxy', async () => {
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(200);
        expect(mocks.callWeeklyReportProxy).toHaveBeenCalledWith(expect.anything(), 'gpt-5.4-mini');
    });

    it('returns 412 when athlete profile is missing', async () => {
        mocks.getAthleteProfile.mockResolvedValueOnce(null);
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(412);
        const json = await response.json();
        expect(json.code).toBe('PROFILE_REQUIRED');
    });

    it('returns 400 when periodStart is not a Monday', async () => {
        const response = await POST({
            request: makeRequest({ ...validBody, periodStart: '2026-05-05', periodEnd: '2026-05-11' }),
            params: { id: userId },
            locals,
        });
        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.code).toBe('INVALID_PERIOD');
    });

    it('returns 400 when periodEnd is not 6 days after periodStart', async () => {
        const response = await POST({
            request: makeRequest({ ...validBody, periodEnd: '2026-05-09' }),
            params: { id: userId },
            locals,
        });
        expect(response.status).toBe(400);
    });

    it('returns 400 when period is in the future', async () => {
        const response = await POST({
            request: makeRequest({ ...validBody, periodStart: '2026-05-18', periodEnd: '2026-05-24' }),
            params: { id: userId },
            locals,
        });
        expect(response.status).toBe(400);
    });

    it('returns 400 when notes exceed 200 chars', async () => {
        const response = await POST({
            request: makeRequest({ ...validBody, notes: 'x'.repeat(201) }),
            params: { id: userId },
            locals,
        });
        expect(response.status).toBe(400);
    });

    it('returns 403 when pre-flight count already meets the monthly limit', async () => {
        mocks.getMonthlyWeeklyReportCount.mockResolvedValueOnce(2);
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(403);
        expect(mocks.fetchGarminActivities).not.toHaveBeenCalled();
        expect(mocks.persistTrainingReport).not.toHaveBeenCalled();
    });

    it('returns 409 when a report exists and overwrite is not set', async () => {
        mocks.findExistingReport.mockResolvedValueOnce({ id: 'existing-1' });
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(409);
        const json = await response.json();
        expect(json.code).toBe('REPORT_EXISTS');
        expect(json.existingId).toBe('existing-1');
    });

    it('returns 400 when goalIds reference unknown or archived goals', async () => {
        mocks.getRunningGoalsByIds.mockResolvedValueOnce([]); // requested 1, got 0
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(400);
    });
});

describe('POST /api/user/[id]/reports/weekly — overwrite, empty week, LLM failure', () => {
    it('proceeds when overwrite=true and an existing report is present', async () => {
        mocks.findExistingReport.mockResolvedValueOnce({ id: 'existing-1' });
        const response = await POST({
            request: makeRequest({ ...validBody, overwrite: true }),
            params: { id: userId },
            locals,
        });
        expect(response.status).toBe(200);
        expect(mocks.persistTrainingReport).toHaveBeenCalledTimes(1);
        const callArgs = mocks.persistTrainingReport.mock.calls[0];
        const consumeSlot = callArgs[1]?.consumeSlot;
        expect(consumeSlot === undefined || consumeSlot === true).toBe(true);
    });

    it('saves the empty-week report with consumeSlot: false (no LLM call)', async () => {
        mocks.fetchGarminActivities.mockResolvedValueOnce({ ok: true, activities: [] });
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(200);
        expect(mocks.callWeeklyReportProxy).not.toHaveBeenCalled();
        expect(mocks.persistTrainingReport).toHaveBeenCalledTimes(1);
        const callArgs = mocks.persistTrainingReport.mock.calls[0];
        expect(callArgs[1]).toEqual({ consumeSlot: false });
    });

    it('returns 502 when LLM proxy fails and never persists the report', async () => {
        mocks.callWeeklyReportProxy.mockResolvedValueOnce({ ok: false, error: 'Proxy 500' });
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(502);
        const json = await response.json();
        expect(json.code).toBe('LLM_FAILED');
        expect(mocks.persistTrainingReport).not.toHaveBeenCalled();
    });

    it('persists the report on the happy path with default consumeSlot', async () => {
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(200);
        expect(mocks.callWeeklyReportProxy).toHaveBeenCalledTimes(1);
        expect(mocks.persistTrainingReport).toHaveBeenCalledTimes(1);
        const callArgs = mocks.persistTrainingReport.mock.calls[0];
        expect(callArgs[1]).toBeUndefined();
    });
});

describe('POST /api/user/[id]/reports/weekly — Garmin errors', () => {
    it('surfaces INVALID_TOKEN from Garmin fetch', async () => {
        mocks.fetchGarminActivities.mockResolvedValueOnce({
            ok: false,
            status: 401,
            code: 'INVALID_TOKEN',
            message: 'No valid token found',
        });
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(401);
        const json = await response.json();
        expect(json.code).toBe('INVALID_TOKEN');
    });

    it('continues without previous-week deltas when previous-week fetch fails', async () => {
        mocks.fetchGarminActivities
            .mockResolvedValueOnce({ ok: true, activities: activitySample }) // current
            .mockResolvedValueOnce({ ok: false, status: 502, code: 'GARMIN_SERVICE_ERROR', message: 'down' }); // prev
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(200);
    });
});

describe('validateBody', () => {
    it('rejects non-object', () => {
        const result = validateBody(null as never);
        expect('error' in result).toBe(true);
    });

    it('rejects when goalIds is not an array of strings', () => {
        const result = validateBody({
            periodStart: '2026-05-04',
            periodEnd: '2026-05-10',
            goalIds: ['ok', 123 as unknown as string],
        });
        expect('error' in result).toBe(true);
    });

    it('treats overwrite as false when omitted', () => {
        const result = validateBody({
            periodStart: '2026-05-04',
            periodEnd: '2026-05-10',
            goalIds: [],
        });
        expect('value' in result).toBe(true);
        if ('value' in result) expect(result.value.overwrite).toBe(false);
    });
});

describe('validateDates', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-14T12:00:00Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('accepts a Mon-Sun pair in the past', () => {
        expect(validateDates('2026-05-04', '2026-05-10', 'UTC')).toEqual({ ok: true });
    });

    it('rejects non-Monday periodStart', () => {
        const result = validateDates('2026-05-05', '2026-05-11', 'UTC');
        expect('error' in result).toBe(true);
    });

    it('rejects when periodEnd is not 6 days later', () => {
        const result = validateDates('2026-05-04', '2026-05-09', 'UTC');
        expect('error' in result).toBe(true);
    });

    it('rejects future periodEnd', () => {
        const result = validateDates('2026-05-18', '2026-05-24', 'UTC');
        expect('error' in result).toBe(true);
    });
});
