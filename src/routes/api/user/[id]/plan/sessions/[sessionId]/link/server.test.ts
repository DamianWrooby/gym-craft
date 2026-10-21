import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({ link: vi.fn(), unlink: vi.fn() }));
vi.mock('$lib/prisma/prisma', () => ({ getAthleteProfile: vi.fn(async () => ({ timezone: 'UTC' })) }));
vi.mock('$lib/server/planner/link', () => ({ linkSession: mocks.link, unlinkSession: mocks.unlink }));

import { DELETE, POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;
const event = (body: unknown, id = userId) => ({
    request: new Request('http://x', { method: 'POST', body: JSON.stringify(body) }),
    params: { id, sessionId: 's-1' },
    locals,
});

describe('/api/user/[id]/plan/sessions/[sessionId]/link', () => {
    beforeEach(() => vi.clearAllMocks());

    it('links the session to the chosen activity', async () => {
        mocks.link.mockResolvedValue({ kind: 'saved', sessionId: 's-1' });
        expect((await POST(event({ activityId: 'a-1' }))).status).toBe(200);
        expect(mocks.link).toHaveBeenCalledWith(userId, 's-1', 'a-1', expect.any(String));
    });

    it('answers 409 when the link is refused', async () => {
        mocks.link.mockResolvedValue({ kind: 'locked', reason: 'Unlink the current activity first' });
        expect((await POST(event({ activityId: 'a-1' }))).status).toBe(409);
    });

    it('unlinks the session', async () => {
        mocks.unlink.mockResolvedValue({ kind: 'saved', sessionId: 's-1' });
        expect((await DELETE(event(null))).status).toBe(200);
    });

    it('refuses another user', async () => {
        expect((await POST(event({ activityId: 'a-1' }, 'someone-else'))).status).toBe(403);
        expect((await DELETE(event(null, 'someone-else'))).status).toBe(403);
        expect(mocks.link).not.toHaveBeenCalled();
    });
});
