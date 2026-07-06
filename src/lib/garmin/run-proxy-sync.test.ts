import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'development' }));

import { runProxySync } from './run-proxy-sync';

const userId = 'user-1';
const garminEmail = 'athlete@example.com';
const sessionToken = 'sess-token-abc';
const syncState = { backfillComplete: false, lastSyncedAt: null };

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('runProxySync', () => {
    it('short-circuits when no Garmin email is configured', async () => {
        const result = await runProxySync({ userId, garminEmail: null, sessionToken, syncState, backfillDays: 60 });
        expect(result).toEqual({ ok: false, code: 'GARMIN_EMAIL_NOT_CONFIGURED', message: expect.any(String) });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('short-circuits with INVALID_TOKEN when there is no session token', async () => {
        const result = await runProxySync({ userId, garminEmail, sessionToken: null, syncState, backfillDays: 60 });
        expect(result).toEqual({ ok: false, code: 'INVALID_TOKEN', message: expect.any(String) });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the session token as a Bearer header to the proxy (no credentials)', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(200, { status: 'success', data: [{ activityId: 1 }] }))
            .mockResolvedValueOnce(jsonResponse(200, { data: { mode: 'backfill', activitiesUpserted: 1, lastSyncedAt: 'x' } }));

        await runProxySync({ userId, garminEmail, sessionToken, syncState, backfillDays: 60 });

        const proxyInit = fetchMock.mock.calls[0][1];
        expect(proxyInit.headers.Authorization).toBe(`Bearer ${sessionToken}`);
        const proxyBody = JSON.parse(proxyInit.body);
        expect(proxyBody.username).toBeUndefined();
        expect(proxyBody.password).toBeUndefined();
        expect(proxyBody.startDate).toBeDefined();
    });

    it('fetches from the proxy then persists, returning the summary', async () => {
        const summary = { mode: 'backfill', activitiesUpserted: 3, lastSyncedAt: '2026-06-02T12:00:00.000Z' };
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(200, { status: 'success', data: [{ activityId: 1 }, { activityId: 2 }] }),
            )
            .mockResolvedValueOnce(jsonResponse(200, { data: summary }));

        const result = await runProxySync({ userId, garminEmail, sessionToken, syncState, backfillDays: 60 });

        expect(result).toEqual({ ok: true, summary });
        // First call hits the proxy, second hits the SvelteKit persist endpoint with the activities + mode.
        const persistBody = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(fetchMock.mock.calls[1][0]).toContain(`/api/user/${userId}/garmin/sync`);
        expect(persistBody.activities).toHaveLength(2);
        expect(persistBody.mode).toBe('backfill');
    });

    it('surfaces INVALID_TOKEN from the proxy without persisting', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(500, { code: 'INVALID_TOKEN', message: 'No valid token found' }));

        const result = await runProxySync({ userId, garminEmail, sessionToken, syncState, backfillDays: 60 });

        expect(result).toEqual({ ok: false, code: 'INVALID_TOKEN', message: expect.any(String) });
        expect(fetchMock).toHaveBeenCalledTimes(1); // never reached the persist call
    });

    it('persists an empty list when the proxy returns a non-array data field', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(200, { status: 'success', data: null }))
            .mockResolvedValueOnce(
                jsonResponse(200, { data: { mode: 'backfill', activitiesUpserted: 0, lastSyncedAt: 'x' } }),
            );

        await runProxySync({ userId, garminEmail, sessionToken, syncState, backfillDays: 60 });

        const persistBody = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(persistBody.activities).toEqual([]);
    });

    it('reports STALE_STATE when the persist endpoint rejects the mode', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(200, { status: 'success', data: [{ activityId: 1 }] }))
            .mockResolvedValueOnce(jsonResponse(409, { code: 'STALE_STATE', message: 'Sync state changed' }));

        const result = await runProxySync({ userId, garminEmail, sessionToken, syncState, backfillDays: 60 });

        expect(result).toEqual({ ok: false, code: 'STALE_STATE', message: expect.any(String) });
    });
});
