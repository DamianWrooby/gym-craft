import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/prisma/prisma', () => ({ getGarminSessionToken: vi.fn() }));
vi.mock('./refresh-session', () => ({ refreshGarminSession: vi.fn() }));

import { getGarminSessionToken } from '$lib/prisma/prisma';
import { refreshGarminSession } from './refresh-session';
import { withGarminSession, type GarminAttemptResult } from './with-garmin-session';

const userId = 'user-1';

const invalidToken = {
    ok: false,
    status: 401,
    code: 'INVALID_TOKEN',
    message: 'No valid token found',
} as const satisfies GarminAttemptResult<never>;

beforeEach(() => {
    vi.mocked(getGarminSessionToken).mockReset();
    vi.mocked(refreshGarminSession).mockReset();
});

describe('withGarminSession', () => {
    it('passes the stored session through and never renews when the call succeeds', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-stored');
        const attempt = vi.fn().mockResolvedValue({ ok: true, value: 'data' });

        const result = await withGarminSession(userId, attempt);

        expect(result).toEqual({ ok: true, value: 'data' });
        expect(attempt).toHaveBeenCalledWith('sess-stored');
        expect(refreshGarminSession).not.toHaveBeenCalled();
    });

    it('renews and retries once when the session is refused, so the athlete sees nothing', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-stale');
        vi.mocked(refreshGarminSession).mockResolvedValue({ ok: true, sessionToken: 'sess-fresh', minted: true });
        const attempt = vi.fn().mockResolvedValueOnce(invalidToken).mockResolvedValueOnce({ ok: true, value: 'data' });

        const result = await withGarminSession(userId, attempt);

        expect(result).toEqual({ ok: true, value: 'data' });
        expect(refreshGarminSession).toHaveBeenCalledWith(userId, 'sess-stale');
        expect(attempt).toHaveBeenNthCalledWith(2, 'sess-fresh');
    });

    it('renews when no session is stored at all, because the authorization outlives the session', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue(null);
        vi.mocked(refreshGarminSession).mockResolvedValue({ ok: true, sessionToken: 'sess-fresh', minted: true });
        const attempt = vi.fn().mockResolvedValue({ ok: true, value: 'data' });

        const result = await withGarminSession(userId, attempt);

        expect(result).toEqual({ ok: true, value: 'data' });
        expect(refreshGarminSession).toHaveBeenCalledWith(userId, null);
        expect(attempt).toHaveBeenCalledTimes(1);
    });

    it('never retries a rate limit, and never turns it into a re-authentication', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-stored');
        const throttled = { ok: false, status: 429, code: 'RATE_LIMITED', message: 'Garmin rate limit' } as const;
        const attempt = vi.fn().mockResolvedValue(throttled);

        const result = await withGarminSession(userId, attempt);

        expect(result).toEqual(throttled);
        expect(attempt).toHaveBeenCalledTimes(1);
        expect(refreshGarminSession).not.toHaveBeenCalled();
    });

    it('surfaces a refused renewal instead of retrying, which is the only case worth a password prompt', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-stale');
        vi.mocked(refreshGarminSession).mockResolvedValue({
            ok: false,
            status: 401,
            code: 'INVALID_TOKEN',
            message: 'authorization dead',
        });
        const attempt = vi.fn().mockResolvedValue(invalidToken);

        const result = await withGarminSession(userId, attempt);

        expect(result).toEqual({ ok: false, status: 401, code: 'INVALID_TOKEN', message: 'authorization dead' });
        expect(attempt).toHaveBeenCalledTimes(1);
    });

    it('retries exactly once, so a dead authorization cannot become a renewal loop', async () => {
        vi.mocked(getGarminSessionToken).mockResolvedValue('sess-stale');
        vi.mocked(refreshGarminSession).mockResolvedValue({ ok: true, sessionToken: 'sess-fresh', minted: true });
        const attempt = vi.fn().mockResolvedValue(invalidToken);

        const result = await withGarminSession(userId, attempt);

        expect(result).toEqual(invalidToken);
        expect(attempt).toHaveBeenCalledTimes(2);
        expect(refreshGarminSession).toHaveBeenCalledTimes(1);
    });
});
