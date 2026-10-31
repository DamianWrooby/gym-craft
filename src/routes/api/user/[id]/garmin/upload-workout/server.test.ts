import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));
vi.mock('$lib/server/garmin/config', () => ({ garminApiUrl: 'http://garmin', garminBearerKeyHeaders: () => ({}) }));

const db = vi.hoisted(() => ({ plannedSession: { findUnique: vi.fn() } }));
vi.mock('$lib/database', () => ({ db }));

const garmin = vi.hoisted(() => ({ withGarminSession: vi.fn() }));
vi.mock('$lib/server/garmin/with-garmin-session', () => garmin);

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

const run = {
    id: 'session-1',
    userId,
    kind: 'RUNNING',
    status: 'PLANNED',
    body: {
        bodyVersion: 1,
        title: 'Easy',
        keySession: null,
        reason: null,
        cutKey: null,
        steps: [{ label: 'z1', durationSec: 1800 }],
    },
};

const call = (body: unknown, id = userId) =>
    POST({
        request: new Request('http://x', { method: 'POST', body: JSON.stringify(body) }),
        params: { id },
        locals,
    });

describe('POST /api/user/[id]/garmin/upload-workout', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        garmin.withGarminSession.mockResolvedValue({ ok: true, value: { status: 'success' } });
    });

    it('builds the workout on the server from a planned session id', async () => {
        db.plannedSession.findUnique.mockResolvedValue(run);
        const res = await call({ plannedSessionId: 'session-1' });
        expect(res.status).toBe(200);
        expect(db.plannedSession.findUnique).toHaveBeenCalledWith({ where: { id: 'session-1' } });
        expect(garmin.withGarminSession).toHaveBeenCalledOnce();
    });

    it.each([
        [{ workout: { workoutName: 'x' } }],
        [{ plannedSessionId: 'session-1', workout: {} }],
        [{ plannedSessionId: 42 }],
        [null],
    ])('rejects any other body: %j', async (body) => {
        const res = await call(body);
        expect(res.status).toBe(400);
        expect(garmin.withGarminSession).not.toHaveBeenCalled();
    });

    it('refuses another user', async () => {
        const res = await call({ plannedSessionId: 'session-1' }, 'someone-else');
        expect(res.status).toBe(403);
    });

    it('treats a session the user does not own as not found', async () => {
        db.plannedSession.findUnique.mockResolvedValue({ ...run, userId: 'someone-else' });
        const res = await call({ plannedSessionId: 'session-1' });
        expect(res.status).toBe(404);
        expect(garmin.withGarminSession).not.toHaveBeenCalled();
    });

    it('refuses a session Garmin cannot take', async () => {
        db.plannedSession.findUnique.mockResolvedValue({
            ...run,
            kind: 'OTHER',
            body: { bodyVersion: 1, title: 'Ride', durationMin: 60, effort: 'easy' },
        });
        const res = await call({ plannedSessionId: 'session-1' });
        expect(res.status).toBe(422);
    });
});
