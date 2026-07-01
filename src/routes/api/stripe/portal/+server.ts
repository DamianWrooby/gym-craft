import { stripe } from '$lib/server/stripe';
import { db } from '$lib/database';
import { createResponse } from '$lib/utils/response';
import { appConfig } from '@/constants/app.constants';
import { PUBLIC_APP_ENV } from '$env/static/public';

export async function POST({ locals }: { locals: App.Locals }): Promise<Response> {
    if (!locals.user) return createResponse(401, { message: 'Unauthorized' });

    const dbUser = await db.user.findUnique({
        where: { id: locals.user.id },
        select: { stripeCustomerId: true },
    });
    if (!dbUser?.stripeCustomerId) {
        return createResponse(400, { code: 'NO_CUSTOMER', message: 'No billing account found' });
    }

    const baseUrl = PUBLIC_APP_ENV === 'development' ? appConfig.baseAppUrlDEV : appConfig.baseAppUrlPROD;
    const session = await stripe.billingPortal.sessions.create({
        customer: dbUser.stripeCustomerId,
        return_url: `${baseUrl}/my-account`,
    });

    return createResponse(200, { url: session.url });
}
