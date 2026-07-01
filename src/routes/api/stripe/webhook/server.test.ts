import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/private', () => ({
    SECRET_STRIPE_KEY: 'sk_test_x',
    SECRET_STRIPE_WEBHOOK_SECRET: 'whsec_x',
}));

const mocks = vi.hoisted(() => ({
    constructEvent: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
    userUpdate: vi.fn(),
    userFindFirst: vi.fn(),
}));

vi.mock('$lib/server/stripe', () => ({
    stripe: {
        webhooks: { constructEvent: mocks.constructEvent },
        subscriptions: { retrieve: mocks.subscriptionsRetrieve },
    },
}));

vi.mock('$lib/database', () => ({
    db: { user: { update: mocks.userUpdate, findFirst: mocks.userFindFirst } },
}));

import { POST } from './+server';

function makeRequest(): Request {
    return new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig' },
        body: '{}',
    });
}

beforeEach(() => {
    mocks.userUpdate.mockResolvedValue({});
    mocks.userFindFirst.mockResolvedValue({ id: 'user-1' });
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/stripe/webhook', () => {
    it('returns 400 when signature verification fails', async () => {
        mocks.constructEvent.mockImplementation(() => {
            throw new Error('bad sig');
        });
        const res = await POST({ request: makeRequest() } as never);
        expect(res.status).toBe(400);
        expect(mocks.userUpdate).not.toHaveBeenCalled();
    });

    it('marks a lifetime supporter on a one-time checkout.session.completed', async () => {
        mocks.constructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: { object: { mode: 'payment', metadata: { userId: 'user-1' }, customer: 'cus_1' } },
        });
        const res = await POST({ request: makeRequest() } as never);
        expect(res.status).toBe(200);
        expect(mocks.userUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'user-1' },
                data: expect.objectContaining({ lifetimeSupporter: true, subscriptionTier: 'SUPPORTER' }),
            }),
        );
    });

    it('writes subscription status on customer.subscription.updated', async () => {
        mocks.constructEvent.mockReturnValue({
            type: 'customer.subscription.updated',
            data: {
                object: {
                    customer: 'cus_1',
                    id: 'sub_1',
                    status: 'active',
                    items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86_400 }] },
                },
            },
        });
        const res = await POST({ request: makeRequest() } as never);
        expect(res.status).toBe(200);
        expect(mocks.userUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'user-1' },
                data: expect.objectContaining({
                    subscriptionTier: 'SUPPORTER',
                    subscriptionStatus: 'active',
                    stripeSubscriptionId: 'sub_1',
                }),
            }),
        );
    });
});
