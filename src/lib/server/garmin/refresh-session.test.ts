import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/prisma/prisma', () => ({
    getGarminEmail: vi.fn(),
    getGarminSessionToken: vi.fn(),
    saveGarminSessionToken: vi.fn(),
}));
vi.mock('./config', () => ({
    garminApiUrl: 'http://garmin.test',
    garminApiHeaders: () => ({ 'Content-Type': 'application/json', 'X-API-Key': 'k' }),
}));

import { getGarminEmail, getGarminSessionToken, saveGarminSessionToken } from '$lib/prisma/prisma';
import { refreshGarminSession } from './refresh-session';

const userId = 'user-1';
const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.mocked(getGarminEmail).mockReset().mockResolvedValue('athlete@example.com');
    vi.mocked(getGarminSessionToken).mockReset();
    vi.mocked(saveGarminSessionToken).mockReset().mockResolvedValue(undefined);
});

describe('refreshGarminSession', () => {
    it('mints a session and persists it when the stored token is the one that failed', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-stale');
        fetchMock.mockResolvedValue(jsonResponse(200, { status: 'success', session_token: 'sess-fresh' }));

        const result = await refreshGarminSession(userId, 'sess-stale');

        expect(result).toEqual({ ok: true, sessionToken: 'sess-fresh', minted: true });
        expect(saveGarminSessionToken).toHaveBeenCalledWith(userId, 'sess-fresh');
    });

    it('sends the email from the user record, never one supplied by a caller', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-stale');
        fetchMock.mockResolvedValue(jsonResponse(200, { status: 'success', session_token: 'sess-fresh' }));

        await refreshGarminSession(userId, 'sess-stale');

        expect(getGarminEmail).toHaveBeenCalledWith(userId);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ username: 'athlete@example.com' });
    });

    it('returns the token another request already minted instead of minting a second', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-someone-else-renewed');

        const result = await refreshGarminSession(userId, 'sess-stale');

        expect(result).toEqual({ ok: true, sessionToken: 'sess-someone-else-renewed', minted: false });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(saveGarminSessionToken).not.toHaveBeenCalled();
    });

    it('maps REAUTH_REQUIRED onto INVALID_TOKEN, the code every caller already treats as "log in"', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-stale');
        fetchMock.mockResolvedValue(jsonResponse(401, { code: 'REAUTH_REQUIRED', message: 'authorization dead' }));

        const result = await refreshGarminSession(userId, 'sess-stale');

        expect(result).toEqual({ ok: false, status: 401, code: 'INVALID_TOKEN', message: 'authorization dead' });
        expect(saveGarminSessionToken).not.toHaveBeenCalled();
    });

    it('keeps a throttle separate from a credential failure', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-stale');
        fetchMock.mockResolvedValue(jsonResponse(429, { code: 'RATE_LIMITED', message: 'Garmin rate limit' }));

        const result = await refreshGarminSession(userId, 'sess-stale');

        expect(result).toEqual({ ok: false, status: 429, code: 'RATE_LIMITED', message: 'Garmin rate limit' });
    });

    it('reports a missing Garmin email rather than calling the service', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue(null);
        vi.mocked(getGarminEmail).mockResolvedValue(false);

        const result = await refreshGarminSession(userId, null);

        expect(result).toEqual({
            ok: false,
            status: 400,
            code: 'GARMIN_EMAIL_NOT_CONFIGURED',
            message: expect.any(String),
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
