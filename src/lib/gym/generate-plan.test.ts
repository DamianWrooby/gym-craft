import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generatePlan, isRetryableCode } from './generate-plan';
import type { SurveyFormModel } from '@/models/survey/survey-form.model';

const url = 'http://localhost:3000/api/generate-plan';
const session = 'hashed-session-token';
const formData = { personalInfo: { sex: 'male' } } as unknown as SurveyFormModel;

const fetchMock = vi.fn();

function textResponse(status: number, body: string): Response {
    return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('generatePlan', () => {
    it('posts the session alongside the form data', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { workouts: [] }));

        await generatePlan(url, session, formData);

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.session).toBe(session);
        expect(body.formData).toEqual(formData);
    });

    it('returns the plan on success', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { workouts: [{ id: 1 }] }));

        const result = await generatePlan(url, session, formData);

        expect(result).toEqual({ ok: true, plan: { workouts: [{ id: 1 }] } });
    });

    it('maps a 401 to INVALID_SESSION with the proxy message', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(401, { code: 'INVALID_SESSION', message: 'Session expired or invalid — log in again' }),
        );

        const result = await generatePlan(url, session, formData);

        expect(result).toEqual({
            ok: false,
            code: 'INVALID_SESSION',
            message: 'Session expired or invalid — log in again',
        });
    });

    it('maps the plain-text 400 to INVALID_FORM_DATA instead of a parse error', async () => {
        fetchMock.mockResolvedValueOnce(textResponse(400, 'Invalid form data'));

        const result = await generatePlan(url, session, formData);

        expect(result).toEqual({ ok: false, code: 'INVALID_FORM_DATA', message: 'Invalid form data' });
    });

    it('maps the plain-text 500 to PROXY_ERROR instead of a parse error', async () => {
        fetchMock.mockResolvedValueOnce(textResponse(500, 'Invalid response from OpenAI'));

        const result = await generatePlan(url, session, formData);

        expect(result).toEqual({ ok: false, code: 'PROXY_ERROR', message: 'Invalid response from OpenAI' });
    });

    it('maps the JSON 500 to PROXY_ERROR', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'Internal server error' }));

        const result = await generatePlan(url, session, formData);

        expect(result).toEqual({ ok: false, code: 'PROXY_ERROR', message: 'Internal server error' });
    });

    it('reports a network failure as PROXY_ERROR', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));

        const result = await generatePlan(url, session, formData);

        expect(result).toEqual({ ok: false, code: 'PROXY_ERROR', message: 'Failed to fetch' });
    });

    it('rejects a 200 whose body is not JSON', async () => {
        fetchMock.mockResolvedValueOnce(textResponse(200, '<html>gateway</html>'));

        const result = await generatePlan(url, session, formData);

        expect(result).toEqual({ ok: false, code: 'PROXY_ERROR', message: 'Invalid proxy response' });
    });
});

describe('isRetryableCode', () => {
    it('only allows retries for transient proxy failures', () => {
        expect(isRetryableCode('PROXY_ERROR')).toBe(true);
        expect(isRetryableCode('INVALID_SESSION')).toBe(false);
        expect(isRetryableCode('INVALID_FORM_DATA')).toBe(false);
    });
});
