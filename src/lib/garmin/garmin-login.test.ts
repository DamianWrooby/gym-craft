import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticateGarmin: vi.fn() }));
vi.mock('./authenticate', () => ({ authenticateGarmin: mocks.authenticateGarmin }));

import { withGarminLogin } from './garmin-login';

const fetchMock = vi.fn();
const creds = { email: 'a@b.co', password: 'secret' };

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    mocks.authenticateGarmin.mockResolvedValue({ ok: true, sessionToken: 'fresh' });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe('withGarminLogin', () => {
    it('returns a success without asking for credentials', async () => {
        const ask = vi.fn();
        const result = await withGarminLogin('u1', async () => ({ ok: true }), ask);
        expect(result).toEqual({ ok: true });
        expect(ask).not.toHaveBeenCalled();
    });

    it('returns other failures without asking', async () => {
        const ask = vi.fn();
        const result = await withGarminLogin('u1', async () => ({ ok: false, code: 'RATE_LIMITED' }), ask);
        expect(result).toEqual({ ok: false, code: 'RATE_LIMITED' });
        expect(ask).not.toHaveBeenCalled();
    });

    it('on INVALID_TOKEN: saves the email, signs in, and retries once with the new token', async () => {
        const action = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, code: 'INVALID_TOKEN' })
            .mockResolvedValueOnce({ ok: true });

        const result = await withGarminLogin('u1', action, async () => creds);

        expect(result).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledWith('/api/user/u1/garmin/save-email', expect.anything());
        expect(mocks.authenticateGarmin).toHaveBeenCalledWith('u1', 'secret');
        expect(action).toHaveBeenNthCalledWith(1, null);
        expect(action).toHaveBeenNthCalledWith(2, { sessionToken: 'fresh', email: 'a@b.co' });
    });

    it('treats a missing Garmin email as a login prompt too', async () => {
        const action = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, code: 'GARMIN_EMAIL_NOT_CONFIGURED' })
            .mockResolvedValueOnce({ ok: true });
        expect(await withGarminLogin('u1', action, async () => creds)).toEqual({ ok: true });
    });

    it('does not loop: a second INVALID_TOKEN is returned', async () => {
        const action = vi.fn().mockResolvedValue({ ok: false, code: 'INVALID_TOKEN' });
        const result = await withGarminLogin('u1', action, async () => creds);
        expect(result).toEqual({ ok: false, code: 'INVALID_TOKEN' });
        expect(action).toHaveBeenCalledTimes(2);
    });

    it('reports a cancelled prompt', async () => {
        const result = await withGarminLogin(
            'u1',
            async () => ({ ok: false, code: 'INVALID_TOKEN' }),
            async () => null,
        );
        expect(result).toMatchObject({ ok: false, code: 'LOGIN_CANCELLED' });
    });

    it('reports a failed sign-in and does not retry', async () => {
        mocks.authenticateGarmin.mockResolvedValue({ ok: false, message: 'MFA Required' });
        const action = vi.fn().mockResolvedValue({ ok: false, code: 'INVALID_TOKEN' });
        const result = await withGarminLogin('u1', action, async () => creds);
        expect(result).toEqual({ ok: false, code: 'LOGIN_FAILED', message: 'MFA Required' });
        expect(action).toHaveBeenCalledOnce();
    });

    it('rejects invalid credentials before any request', async () => {
        const result = await withGarminLogin(
            'u1',
            async () => ({ ok: false, code: 'INVALID_TOKEN' }),
            async () => ({ email: 'not-an-email', password: 'x' }),
        );
        expect(result).toMatchObject({ ok: false, code: 'LOGIN_FAILED' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
