import { stripe } from '$lib/server/stripe';
import { db } from '$lib/database';
import { SECRET_STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import type Stripe from 'stripe';

export async function POST({ request }: { request: Request }): Promise<Response> {
    const signature = request.headers.get('stripe-signature') ?? '';
    const payload = await request.text();

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(payload, signature, SECRET_STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return new Response(`Webhook signature verification failed: ${(err as Error).message}`, { status: 400 });
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId ?? session.client_reference_id ?? undefined;
            if (!userId) break;

            if (session.mode === 'payment') {
                // One-time "lifetime" purchase.
                await db.user.update({
                    where: { id: userId },
                    data: {
                        lifetimeSupporter: true,
                        subscriptionTier: 'SUPPORTER',
                        stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
                    },
                });
            } else if (session.mode === 'subscription' && session.subscription) {
                const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
                const sub = await stripe.subscriptions.retrieve(subId);
                await applySubscription(userId, sub);
            }
            break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription;
            const userId = await userIdForCustomer(sub.customer);
            if (userId) await applySubscription(userId, sub);
            break;
        }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
}

async function applySubscription(userId: string, sub: Stripe.Subscription): Promise<void> {
    const isActive = sub.status === 'active' || sub.status === 'trialing';
    await db.user.update({
        where: { id: userId },
        data: {
            subscriptionTier: isActive ? 'SUPPORTER' : 'FREE',
            subscriptionStatus: sub.status,
            stripeSubscriptionId: sub.id,
            stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
            currentPeriodEnd: periodEndFromSubscription(sub),
        },
    });
}

// In the current Stripe API, current_period_end lives on the subscription item,
// not the subscription itself. Read it from the first item.
function periodEndFromSubscription(sub: Stripe.Subscription): Date | null {
    const ts = sub.items?.data?.[0]?.current_period_end;
    return typeof ts === 'number' ? new Date(ts * 1000) : null;
}

async function userIdForCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer): Promise<string | null> {
    const customerId = typeof customer === 'string' ? customer : customer.id;
    const user = await db.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } });
    return user?.id ?? null;
}
