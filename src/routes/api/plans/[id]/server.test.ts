import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ updatePlanName: vi.fn(), deletePlan: vi.fn() }));
vi.mock('$lib/prisma/prisma', () => mocks);

import { POST, DELETE } from './+server';

const locals = { user: { id: 'user-1', name: 'u', role: 'USER', subscriptionTier: 'FREE' } };

function makeEvent(method: 'POST' | 'DELETE', body?: string, id = 'plan-1') {
    return {
        params: { id },
        request: new Request('http://localhost/api/plans/' + id, { method, body }),
        locals,
    } as never;
}

afterEach(() => vi.clearAllMocks());

describe('POST /api/plans/[id]', () => {
    it('renames the plan', async () => {
        mocks.updatePlanName.mockResolvedValue({});
        const res = await POST(makeEvent('POST', JSON.stringify({ name: 'Leg day' })));
        expect(res.status).toBe(200);
        expect(mocks.updatePlanName).toHaveBeenCalledWith('plan-1', 'Leg day', 'user-1');
    });

    it('returns 400 for a malformed body instead of throwing', async () => {
        const res = await POST(makeEvent('POST', '{not json'));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ message: 'Plan name is required' });
        expect(mocks.updatePlanName).not.toHaveBeenCalled();
    });

    it('returns 502 with a message when the database fails', async () => {
        mocks.updatePlanName.mockRejectedValue(new Error('boom'));
        const res = await POST(makeEvent('POST', JSON.stringify({ name: 'x' })));
        expect(res.status).toBe(502);
        expect(await res.json()).toEqual({ message: 'Database error' });
    });
});

describe('DELETE /api/plans/[id]', () => {
    it('returns the removed plan', async () => {
        mocks.deletePlan.mockResolvedValue({ id: 'plan-1' });
        const res = await DELETE(makeEvent('DELETE'));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ id: 'plan-1' });
    });

    it('returns 502 with a message when the database fails', async () => {
        mocks.deletePlan.mockRejectedValue(new Error('boom'));
        const res = await DELETE(makeEvent('DELETE'));
        expect(res.status).toBe(502);
        expect(await res.json()).toEqual({ message: 'Database error' });
    });
});
