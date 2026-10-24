import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));
vi.mock('$lib/prisma/prisma', () => ({ getAthleteProfile: vi.fn() }));

const tx = vi.hoisted(() => ({ planWeek: { update: vi.fn() }, aiRequest: { updateMany: vi.fn() } }));
const db = vi.hoisted(() => ({ $transaction: vi.fn(), planWeek: { findUnique: vi.fn() } }));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

const failedWeek = (retryCount = 0, overrides: Record<string, unknown> = {}) => ({
    id: 'week-1',
    userId,
    generation: 'FAILED',
    aiRequest: { id: 'request-1', status: 'FAILED', retryCount },
    ...overrides,
});

function post(id = userId) {
    return POST({ request: new Request('http://test', { method: 'POST' }), params: { id, weekId: 'week-1' }, locals });
}

beforeEach(() => {
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    db.planWeek.findUnique.mockResolvedValue(failedWeek());
    tx.aiRequest.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/user/[id]/plan/weeks/[weekId]/retry', () => {
    it('returns 403 for another user', async () => {
        expect((await post('someone-else')).status).toBe(403);
    });

    it('returns 404 for a week the athlete does not own', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(failedWeek(0, { userId: 'someone-else' }));
        expect((await post()).status).toBe(404);
    });

    it('re-opens the failed request and counts the retry', async () => {
        const response = await post();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: { aiRequestId: 'request-1', retriesLeft: 1 } });
        expect(tx.aiRequest.updateMany).toHaveBeenCalledWith({
            where: { id: 'request-1', status: 'FAILED', retryCount: 0 },
            data: { status: 'PENDING', output: null, error: null, retryCount: 1 },
        });
        expect(tx.planWeek.update).toHaveBeenCalledWith({ where: { id: 'week-1' }, data: { generation: 'PENDING' } });
    });

    it('refuses a third retry', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(failedWeek(2));
        const response = await post();
        expect(response.status).toBe(429);
        expect(await response.json()).toMatchObject({ code: 'RETRY_LIMIT' });
        expect(tx.aiRequest.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a retry that lost the race to a parallel one', async () => {
        tx.aiRequest.updateMany.mockResolvedValueOnce({ count: 0 });
        expect((await post()).status).toBe(409);
        expect(tx.planWeek.update).not.toHaveBeenCalled();
    });

    it('refuses a week that has not failed', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(failedWeek(0, { generation: 'GENERATED' }));
        expect((await post()).status).toBe(409);
    });
});
