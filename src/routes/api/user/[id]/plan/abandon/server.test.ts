import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const tx = vi.hoisted(() => ({ plan: { updateMany: vi.fn() }, aiUsage: { upsert: vi.fn() } }));
const db = vi.hoisted(() => ({
    aiUsage: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
}));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';

const userId = 'user-1';
const locals = (tier = 'FREE') => ({ user: { id: userId, subscriptionTier: tier } }) as unknown as App.Locals;
const post = (l = locals(), id = userId) => POST({ params: { id }, locals: l });

afterEach(() => vi.clearAllMocks());

describe('POST /api/user/[id]/plan/abandon', () => {
    it('refuses another user', async () => {
        expect((await post(locals(), 'someone-else')).status).toBe(403);
        expect(tx.plan.updateMany).not.toHaveBeenCalled();
    });

    it('abandons the active plan, keeps its rows and counts one plan revision', async () => {
        db.aiUsage.findUnique.mockResolvedValueOnce({ count: 1 });
        tx.plan.updateMany.mockResolvedValueOnce({ count: 1 });
        const response = await post();
        expect(response.status).toBe(200);
        expect(tx.plan.updateMany).toHaveBeenCalledWith({
            where: { userId, state: 'ACTIVE' },
            data: { state: 'ABANDONED' },
        });
        expect(tx.aiUsage.upsert.mock.calls[0][0].update).toEqual({ count: { increment: 1 } });
        expect(tx.aiUsage.upsert.mock.calls[0][0].create).toMatchObject({ kind: 'plan_revision', count: 1 });
    });

    it('answers 404 and counts nothing when there is no active plan', async () => {
        db.aiUsage.findUnique.mockResolvedValueOnce(null);
        tx.plan.updateMany.mockResolvedValueOnce({ count: 0 });
        const response = await post();
        expect(response.status).toBe(404);
        expect(tx.aiUsage.upsert).not.toHaveBeenCalled();
    });

    it('refuses at the revision cap and leaves the plan active', async () => {
        db.aiUsage.findUnique.mockResolvedValueOnce({ count: 4 });
        const response = await post();
        expect(response.status).toBe(429);
        expect((await response.json()).code).toBe('REVISION_CAP');
        expect(tx.plan.updateMany).not.toHaveBeenCalled();
    });

    it('reads the supporter cap', async () => {
        db.aiUsage.findUnique.mockResolvedValueOnce({ count: 4 });
        tx.plan.updateMany.mockResolvedValueOnce({ count: 1 });
        expect((await post(locals('SUPPORTER'))).status).toBe(200);
    });
});
