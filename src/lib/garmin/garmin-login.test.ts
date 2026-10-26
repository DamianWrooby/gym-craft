import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticateGarmin: vi.fn(), submitGarminMfaCode: vi.fn() }));
vi.mock('./authenticate', () => ({
    authenticateGarmin: mocks.authenticateGarmin,
    submitGarminMfaCode: mocks.submitGarminMfaCode,
}));

import { withGarminLogin } from './garmin-login';

const fetchMock = vi.fn();
const creds = { email: 'a@b.co', password: 'secret' };
const noMfa = vi.fn();

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
        const result = await withGarminLogin('u1', async () => ({ ok: true }), ask, noMfa);
        expect(result).toEqual({ ok: true });
        expect(ask).not.toHaveBeenCalled();
    });

    it('returns other failures without asking', async () => {
        const ask = vi.fn();
        const result = await withGarminLogin('u1', async () => ({ ok: false, code: 'RATE_LIMITED' }), ask, noMfa);
        expect(result).toEqual({ ok: false, code: 'RATE_LIMITED' });
        expect(ask).not.toHaveBeenCalled();
    });

    it('on INVALID_TOKEN: saves the email, signs in, and retries once with the new token', async () => {
        const action = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, code: 'INVALID_TOKEN' })
            .mockResolvedValueOnce({ ok: true });

        const result = await withGarminLogin('u1', action, async () => creds, noMfa);

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
        expect(await withGarminLogin('u1', action, async () => creds, noMfa)).toEqual({ ok: true });
    });

    it('does not loop: a second INVALID_TOKEN is returned', async () => {
        const action = vi.fn().mockResolvedValue({ ok: false, code: 'INVALID_TOKEN' });
        const result = await withGarminLogin('u1', action, async () => creds, noMfa);
        expect(result).toEqual({ ok: false, code: 'INVALID_TOKEN' });
        expect(action).toHaveBeenCalledTimes(2);
    });

    it('reports a cancelled prompt', async () => {
        const result = await withGarminLogin(
            'u1',
            async () => ({ ok: false, code: 'INVALID_TOKEN' }),
            async () => null,
            noMfa,
        );
        expect(result).toMatchObject({ ok: false, code: 'LOGIN_CANCELLED' });
    });

    it('reports a failed sign-in and does not retry', async () => {
        mocks.authenticateGarmin.mockResolvedValue({ ok: false, message: 'MFA Required' });
        const action = vi.fn().mockResolvedValue({ ok: false, code: 'INVALID_TOKEN' });
        const result = await withGarminLogin('u1', action, async () => creds, noMfa);
        expect(result).toEqual({ ok: false, code: 'LOGIN_FAILED', message: 'MFA Required' });
        expect(action).toHaveBeenCalledOnce();
    });

    it('rejects invalid credentials before any request', async () => {
        const result = await withGarminLogin(
            'u1',
            async () => ({ ok: false, code: 'INVALID_TOKEN' }),
            async () => ({ email: 'not-an-email', password: 'x' }),
            noMfa,
        );
        expect(result).toMatchObject({ ok: false, code: 'LOGIN_FAILED' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    describe('email MFA', () => {
        const action = () =>
            vi.fn().mockResolvedValueOnce({ ok: false, code: 'INVALID_TOKEN' }).mockResolvedValueOnce({ ok: true });

        beforeEach(() => {
            mocks.authenticateGarmin.mockResolvedValue({ ok: false, code: 'MFA_REQUIRED', mfaTicket: 't1' });
        });

        it('asks for the code, finishes the login, and retries with the new token', async () => {
            mocks.submitGarminMfaCode.mockResolvedValue({ ok: true, sessionToken: 'mfa-token' });
            const ask = vi.fn().mockResolvedValue('123456');
            const act = action();

            const result = await withGarminLogin('u1', act, async () => creds, ask);

            expect(result).toEqual({ ok: true });
            expect(ask).toHaveBeenCalledWith(false);
            expect(mocks.submitGarminMfaCode).toHaveBeenCalledWith('u1', 't1', '123456');
            expect(act).toHaveBeenNthCalledWith(2, { sessionToken: 'mfa-token', email: 'a@b.co' });
        });

        it('asks again after a wrong code', async () => {
            mocks.submitGarminMfaCode
                .mockResolvedValueOnce({ ok: false, code: 'MFA_INVALID_CODE', message: 'bad' })
                .mockResolvedValueOnce({ ok: true, sessionToken: 'mfa-token' });
            const ask = vi.fn().mockResolvedValueOnce('000000').mockResolvedValueOnce('123456');

            const result = await withGarminLogin('u1', action(), async () => creds, ask);

            expect(result).toEqual({ ok: true });
            expect(ask).toHaveBeenNthCalledWith(2, true);
        });

        it('reports an expired ticket as a failed login', async () => {
            mocks.submitGarminMfaCode.mockResolvedValue({ ok: false, code: 'MFA_EXPIRED', message: 'gone' });
            const result = await withGarminLogin(
                'u1',
                action(),
                async () => creds,
                async () => '123456',
            );
            expect(result).toMatchObject({ ok: false, code: 'LOGIN_FAILED' });
        });

        it('reports a cancelled code prompt', async () => {
            const result = await withGarminLogin(
                'u1',
                action(),
                async () => creds,
                async () => null,
            );
            expect(result).toMatchObject({ ok: false, code: 'LOGIN_CANCELLED' });
            expect(mocks.submitGarminMfaCode).not.toHaveBeenCalled();
        });
    });
});
