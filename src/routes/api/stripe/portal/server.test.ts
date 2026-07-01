import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'development' }));
vi.mock('$env/static/private', () => ({ SECRET_STRIPE_KEY: 'sk_test_x' }));

const mocks = vi.hoisted(() => ({
    portalCreate: vi.fn(),
    userFindUnique: vi.fn(),
}));

vi.mock('$lib/server/stripe', () => ({
    stripe: { billingPortal: { sessions: { create: mocks.portalCreate } } },
}));

vi.mock('$lib/database', () => ({
    db: { user: { findUnique: mocks.userFindUnique } },
}));

import { POST } from './+server';

const locals = { user: { id: 'user-1' } } as unknown as App.Locals;

beforeEach(() => {
    mocks.portalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/p/x' });
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/stripe/portal', () => {
    it('returns 400 when the user has no stripe customer', async () => {
        mocks.userFindUnique.mockResolvedValue({ stripeCustomerId: null });
        const res = await POST({ locals } as never);
        expect(res.status).toBe(400);
    });

    it('returns a portal url for a customer', async () => {
        mocks.userFindUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
        const res = await POST({ locals } as never);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.url).toBe('https://billing.stripe.com/p/x');
    });
});
