import crypto from 'crypto';
import { db } from '$lib/database';
import { resolveTier } from '$lib/server/subscription/tier';
import { TIER_LIMITS } from '@/constants/subscription.constants';
import { currentMonthStartIso } from '$lib/utils/iso-week';
import type { RequestEvent } from '@sveltejs/kit';

function hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function updateUser(event: RequestEvent) {
    const session = event.cookies?.get('session');

    if (!session) return;

    const hashedSession = hashSessionToken(session);

    const user = await db.user.findUnique({
        where: { userAuthToken: hashedSession },
        select: {
            id: true,
            username: true,
            role: true,
            generatedPlansNumber: true,
            emailVerified: true,
            marketingAgreement: true,
            email: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
            lifetimeSupporter: true,
        },
    });

    const configuration = await db.configuration.findFirst({
        where: { name: 'generalPlanLimit' },
        select: { value: true },
    });

    if (user) {
        const { id, username, role, generatedPlansNumber, emailVerified, marketingAgreement, email } = user;
        const subscriptionTier = resolveTier({
            lifetimeSupporter: user.lifetimeSupporter,
            subscriptionStatus: user.subscriptionStatus,
            currentPeriodEnd: user.currentPeriodEnd,
        });

        // FREE: lifetime allowance (Configuration limit − generated plans).
        // SUPPORTER: monthly allowance tracked via AiUsage kind='gym_plan'.
        let plansLeft = configuration ? +configuration.value - user.generatedPlansNumber : 0;
        if (subscriptionTier === 'SUPPORTER') {
            const monthKey = currentMonthStartIso();
            const usage = await db.aiUsage.findUnique({
                where: { userId_kind_day: { userId: user.id, kind: 'gym_plan', day: monthKey } },
                select: { count: true },
            });
            plansLeft = Math.max(0, (TIER_LIMITS.SUPPORTER.gymPlansPerMonth ?? 0) - (usage?.count ?? 0));
        }
        if (event.locals) {
            event.locals.user = {
                id,
                name: username,
                role: role.name,
                generatedPlansNumber,
                plansLeft,
                emailVerified,
                marketingAgreement,
                email,
                subscriptionTier,
            };
        }
    }
}
