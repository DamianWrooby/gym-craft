import { describe, expect, it, vi } from 'vitest';

// Separate file from server.test.ts because $env/static mocks are module-level:
// this one runs the endpoint with billing disabled.
vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'development', PUBLIC_BILLING_ENABLED: 'false' }));
vi.mock('$env/static/private', () => ({
    SECRET_STRIPE_KEY: 'sk_test_x',
    STRIPE_PRICE_MONTHLY: 'price_monthly',
    STRIPE_PRICE_ANNUAL: 'price_annual',
    STRIPE_PRICE_LIFETIME: 'price_lifetime',
}));

const mocks = vi.hoisted(() => ({
    sessionsCreate: vi.fn(),
}));

vi.mock('$lib/server/stripe', () => ({
    stripe: { checkout: { sessions: { create: mocks.sessionsCreate } } },
}));

vi.mock('$lib/database', () => ({
    db: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { POST } from './+server';

describe('POST /api/stripe/checkout with billing disabled', () => {
    it('returns 503 BILLING_DISABLED without touching Stripe', async () => {
        const request = new Request('http://localhost/api/stripe/checkout', {
            method: 'POST',
            body: JSON.stringify({ plan: 'monthly' }),
        });
        const locals = { user: { id: 'user-1', subscriptionTier: 'FREE' } } as unknown as App.Locals;

        const res = await POST({ request, locals } as never);

        expect(res.status).toBe(503);
        const json = await res.json();
        expect(json.code).toBe('BILLING_DISABLED');
        expect(mocks.sessionsCreate).not.toHaveBeenCalled();
    });
});
