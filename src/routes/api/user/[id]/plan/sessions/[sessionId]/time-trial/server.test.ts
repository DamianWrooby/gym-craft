import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const tx = vi.hoisted(() => ({ plannedSession: { updateMany: vi.fn() }, raceResult: { create: vi.fn() } }));
const db = vi.hoisted(() => ({ $transaction: vi.fn(), plannedSession: { findUnique: vi.fn() } }));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;
const date = new Date('2026-10-22T00:00:00Z');

const timeTrial = {
    id: 'tt-1',
    userId,
    kind: 'RUNNING',
    status: 'PLANNED',
    activityId: null,
    scheduledDate: date,
    planWeek: { timeTrialDistanceM: 5000 },
};

const call = (body: unknown, id = userId) =>
    POST({
        request: new Request('http://x', { method: 'POST', body: JSON.stringify(body) }),
        params: { id, sessionId: 'tt-1' },
        locals,
    });

describe('POST /api/user/[id]/plan/sessions/[sessionId]/time-trial', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
        tx.plannedSession.updateMany.mockResolvedValue({ count: 1 });
        db.plannedSession.findUnique.mockResolvedValue(timeTrial);
    });

    it('turns the result into a race result and marks the session done', async () => {
        const res = await call({ timeSec: 1290 });
        expect(res.status).toBe(201);
        expect(tx.raceResult.create).toHaveBeenCalledWith({
            data: { userId, date, distanceM: 5000, timeSec: 1290, label: 'Time trial' },
        });
    });

    it('records one race result when the same result is sent twice', async () => {
        tx.plannedSession.updateMany.mockResolvedValue({ count: 0 });
        expect((await call({ timeSec: 1290 })).status).toBe(409);
        expect(tx.raceResult.create).not.toHaveBeenCalled();
    });

    it('refuses a session already settled', async () => {
        db.plannedSession.findUnique.mockResolvedValue({ ...timeTrial, status: 'DONE' });
        expect((await call({ timeSec: 1290 })).status).toBe(409);
    });

    it('refuses another user', async () => {
        expect((await call({ timeSec: 1290 }, 'someone-else')).status).toBe(403);
    });

    it('treats a session the user does not own as not found', async () => {
        db.plannedSession.findUnique.mockResolvedValue({ ...timeTrial, userId: 'someone-else' });
        expect((await call({ timeSec: 1290 })).status).toBe(404);
        expect(db.$transaction).not.toHaveBeenCalled();
    });
});
