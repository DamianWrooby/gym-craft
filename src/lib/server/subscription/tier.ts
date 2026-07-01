import type { SubscriptionTier } from '@/constants/subscription.constants';

export interface TierInputs {
    lifetimeSupporter: boolean;
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
}

export function resolveTier(u: TierInputs, now: Date = new Date()): SubscriptionTier {
    if (u.lifetimeSupporter) return 'SUPPORTER';
    if (u.subscriptionStatus === 'active' && u.currentPeriodEnd && u.currentPeriodEnd > now) {
        return 'SUPPORTER';
    }
    return 'FREE';
}
