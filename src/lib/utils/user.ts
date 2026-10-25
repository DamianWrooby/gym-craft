import { db } from '$lib/database';
import { resolveTier } from '$lib/server/subscription/tier';
import { hashSessionToken } from '$lib/server/session-token';
import { getGeneralPlanLimit } from '$lib/prisma/prisma';
import { TIER_LIMITS, resolveAiModel } from '@/constants/subscription.constants';
import { currentMonthStartIso } from '$lib/utils/iso-week';
import { PUBLIC_APP_ENV } from '$env/static/public';
import { DEFAULT_LOCALE, enabledLocales, isEnabledLocale } from '@/constants/locale.constants';
import type { RequestEvent } from '@sveltejs/kit';

/** SUPPORTER: monthly allowance tracked via AiUsage kind='gym_plan'. */
async function supporterPlansLeft(userId: string): Promise<number> {
    const usage = await db.aiUsage.findUnique({
        where: { userId_kind_day: { userId, kind: 'gym_plan', day: currentMonthStartIso() } },
        select: { count: true },
    });
    return Math.max(0, (TIER_LIMITS.SUPPORTER.gymPlansPerMonth ?? 0) - (usage?.count ?? 0));
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
            aiModelPreference: true,
            locale: true,
        },
    });

    if (!user) return;

    const { id, username, role, generatedPlansNumber, emailVerified, marketingAgreement, email } = user;
    const subscriptionTier = resolveTier({
        subscriptionStatus: user.subscriptionStatus,
        currentPeriodEnd: user.currentPeriodEnd,
    });

    // This runs on every authenticated request, so only the branch that applies is
    // queried. Previously both ran serially and, for a SUPPORTER, the FREE result was
    // computed from a freshly-fetched Configuration row and then discarded.
    // FREE: lifetime allowance (Configuration limit − generated plans), cached.
    let plansLeft: number;
    if (subscriptionTier === 'SUPPORTER') {
        plansLeft = await supporterPlansLeft(id);
    } else {
        const generalPlanLimit = await getGeneralPlanLimit();
        plansLeft = generalPlanLimit > 0 ? generalPlanLimit - generatedPlansNumber : 0;
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
            aiModel: resolveAiModel(subscriptionTier, user.aiModelPreference),
            locale: isEnabledLocale(user.locale, enabledLocales(PUBLIC_APP_ENV)) ? user.locale : DEFAULT_LOCALE,
        };
    }
}
