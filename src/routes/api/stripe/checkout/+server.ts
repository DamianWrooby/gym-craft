import { stripe } from '$lib/server/stripe';
import { db } from '$lib/database';
import { createResponse } from '$lib/utils/response';
import { appConfig } from '@/constants/app.constants';
import { PUBLIC_APP_ENV } from '$env/static/public';
import { STRIPE_PRICE_ANNUAL, STRIPE_PRICE_LIFETIME, STRIPE_PRICE_MONTHLY } from '$env/static/private';

type PlanKey = 'monthly' | 'annual' | 'lifetime';

const PLANS: Record<PlanKey, { price: string; mode: 'subscription' | 'payment' }> = {
    monthly: { price: STRIPE_PRICE_MONTHLY, mode: 'subscription' },
    annual: { price: STRIPE_PRICE_ANNUAL, mode: 'subscription' },
    lifetime: { price: STRIPE_PRICE_LIFETIME, mode: 'payment' },
};

export async function POST({ request, locals }: { request: Request; locals: App.Locals }): Promise<Response> {
    if (!locals.user) return createResponse(401, { message: 'Unauthorized' });

    const body = await request.json().catch(() => null);
    const plan = body?.plan as PlanKey | undefined;
    const selected = plan ? PLANS[plan] : undefined;
    if (!selected) {
        return createResponse(400, { code: 'INVALID_PLAN', message: 'Unknown plan' });
    }

    const userId = locals.user.id;
    const dbUser = await db.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true, email: true },
    });

    let customerId = dbUser?.stripeCustomerId ?? null;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: dbUser?.email || undefined,
            metadata: { userId },
        });
        customerId = customer.id;
        await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
    }

    const baseUrl = PUBLIC_APP_ENV === 'development' ? appConfig.baseAppUrlDEV : appConfig.baseAppUrlPROD;

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: selected.mode,
        line_items: [{ price: selected.price, quantity: 1 }],
        success_url: `${baseUrl}/my-account?checkout=success`,
        cancel_url: `${baseUrl}/my-account?checkout=cancel`,
        client_reference_id: userId,
        metadata: { userId, plan },
    });

    return createResponse(200, { url: session.url });
}
