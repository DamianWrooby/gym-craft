import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'development' }));
vi.mock('$env/static/private', () => ({
    SECRET_STRIPE_KEY: 'sk_test_x',
    STRIPE_PRICE_MONTHLY: 'price_monthly',
    STRIPE_PRICE_ANNUAL: 'price_annual',
    STRIPE_PRICE_LIFETIME: 'price_lifetime',
}));

const mocks = vi.hoisted(() => ({
    customersCreate: vi.fn(),
    sessionsCreate: vi.fn(),
    userFindUnique: vi.fn(),
    userUpdate: vi.fn(),
}));

vi.mock('$lib/server/stripe', () => ({
    stripe: {
        customers: { create: mocks.customersCreate },
        checkout: { sessions: { create: mocks.sessionsCreate } },
    },
}));

vi.mock('$lib/database', () => ({
    db: { user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate } },
}));

import { POST } from './+server';

const locals = { user: { id: 'user-1', subscriptionTier: 'FREE' } } as unknown as App.Locals;

function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    mocks.userFindUnique.mockResolvedValue({ stripeCustomerId: null, email: 'a@b.com' });
    mocks.customersCreate.mockResolvedValue({ id: 'cus_123' });
    mocks.sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/x' });
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/stripe/checkout', () => {
    it('rejects an unknown plan', async () => {
        const res = await POST({ request: makeRequest({ plan: 'bogus' }), locals } as never);
        expect(res.status).toBe(400);
    });

    it('creates a customer and a checkout session for the monthly plan', async () => {
        const res = await POST({ request: makeRequest({ plan: 'monthly' }), locals } as never);
        expect(res.status).toBe(200);
        expect(mocks.customersCreate).toHaveBeenCalledOnce();
        expect(mocks.sessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'subscription',
                line_items: [{ price: 'price_monthly', quantity: 1 }],
                customer: 'cus_123',
            }),
        );
        const json = await res.json();
        expect(json.url).toBe('https://checkout.stripe.com/x');
    });

    it('uses payment mode for the lifetime plan', async () => {
        await POST({ request: makeRequest({ plan: 'lifetime' }), locals } as never);
        expect(mocks.sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ mode: 'payment' }));
    });
});
