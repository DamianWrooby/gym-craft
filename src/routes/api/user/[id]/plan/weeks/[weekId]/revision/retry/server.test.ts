import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const tx = vi.hoisted(() => ({ aiRequest: { updateMany: vi.fn() }, planWeek: { update: vi.fn() } }));
const db = vi.hoisted(() => ({ $transaction: vi.fn(), planWeek: { findUnique: vi.fn() } }));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

const week = (retryCount: number, status = 'FAILED') => ({
    id: 'week-1',
    userId,
    revisionGeneration: status === 'FAILED' ? 'FAILED' : 'GENERATED',
    revisionRequest: { id: 'request-9', status, retryCount },
    sessions: [],
});

const post = () =>
    POST({
        request: new Request('http://test', { method: 'POST' }),
        params: { id: userId, weekId: 'week-1' },
        locals,
    });

beforeEach(() => {
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    tx.aiRequest.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/plan/weeks/[weekId]/revision/retry', () => {
    it('re-opens a failed revision request', async () => {
        db.planWeek.findUnique.mockResolvedValue(week(1));
        const res = await post();
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ aiRequestId: 'request-9', retriesLeft: 0 });
        expect(tx.aiRequest.updateMany.mock.calls[0][0]).toMatchObject({
            where: { id: 'request-9', status: 'FAILED', retryCount: 1 },
            data: { status: 'PENDING', retryCount: 2 },
        });
    });
});
