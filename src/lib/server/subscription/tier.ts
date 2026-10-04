import type { SubscriptionTier } from '@/constants/subscription.constants';

export interface TierInputs {
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
}

export function resolveTier(u: TierInputs, now: Date = new Date()): SubscriptionTier {
    if (u.subscriptionStatus === 'active' && u.currentPeriodEnd && u.currentPeriodEnd > now) {
        return 'SUPPORTER';
    }
    return 'FREE';
}
