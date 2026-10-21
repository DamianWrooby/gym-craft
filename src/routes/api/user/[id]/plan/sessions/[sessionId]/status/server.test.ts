import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const db = vi.hoisted(() => ({ plannedSession: { findUnique: vi.fn(), update: vi.fn() } }));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;
const lift = { id: 's-1', userId, status: 'PLANNED', activityId: null };

const call = (body: unknown, id = userId) =>
    POST({
        request: new Request('http://x', { method: 'POST', body: JSON.stringify(body) }),
        params: { id, sessionId: 's-1' },
        locals,
    });

describe('POST /api/user/[id]/plan/sessions/[sessionId]/status', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        db.plannedSession.findUnique.mockResolvedValue(lift);
    });

    it('marks a session done by hand', async () => {
        expect((await call({ status: 'DONE' })).status).toBe(200);
        expect(db.plannedSession.update).toHaveBeenCalledWith({ where: { id: 's-1' }, data: { status: 'DONE' } });
    });

    it('leaves a session a synced activity settled', async () => {
        db.plannedSession.findUnique.mockResolvedValue({ ...lift, activityId: 'a-1' });
        expect((await call({ status: 'SKIPPED' })).status).toBe(409);
        expect(db.plannedSession.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown status', async () => {
        expect((await call({ status: 'SUPERSEDED' })).status).toBe(400);
    });

    it('refuses another user', async () => {
        expect((await call({ status: 'DONE' }, 'someone-else')).status).toBe(403);
    });

    it('treats a session the user does not own as not found', async () => {
        db.plannedSession.findUnique.mockResolvedValue({ ...lift, userId: 'someone-else' });
        expect((await call({ status: 'DONE' })).status).toBe(404);
        expect(db.plannedSession.update).not.toHaveBeenCalled();
    });
});
