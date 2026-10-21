import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const db = vi.hoisted(() => ({ user: { update: vi.fn() } }));
vi.mock('$lib/database', () => ({ db }));

import { PUT } from './+server';

function call(id: string, body: unknown, tier: 'FREE' | 'SUPPORTER') {
    const locals = { user: { id: 'user-1', subscriptionTier: tier } } as unknown as App.Locals;
    const request = new Request('http://test/api/user/user-1/ai-model', { method: 'PUT', body: JSON.stringify(body) });
    return PUT({ request, params: { id }, locals });
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('PUT /api/user/[id]/ai-model', () => {
    it('returns 403 for another user', async () => {
        const res = await call('someone-else', { model: 'gpt-5.4' }, 'SUPPORTER');
        expect(res.status).toBe(403);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('stores a model the supporter tier allows', async () => {
        const res = await call('user-1', { model: 'gpt-5.4-mini' }, 'SUPPORTER');
        expect(res.status).toBe(200);
        expect(db.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: { aiModelPreference: 'gpt-5.4-mini' },
        });
    });

    it('rejects a model outside the FREE list', async () => {
        const res = await call('user-1', { model: 'gpt-5.4' }, 'FREE');
        expect(res.status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown model', async () => {
        const res = await call('user-1', { model: 'gpt-4o' }, 'SUPPORTER');
        expect(res.status).toBe(400);
    });
});
