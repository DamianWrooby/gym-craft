export type SubscriptionTier = 'FREE' | 'SUPPORTER';

// Phase 1 caps only. Phase 2 will extend TierLimits with gymPlansPerMonth,
// garminBackfillDays, model, and reportExport. Keep this the single source of truth.
export interface TierLimits {
    weeklyReportsPerMonth: number;
    explainRunsPerDay: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
    FREE: {
        weeklyReportsPerMonth: 2,
        explainRunsPerDay: 1,
    },
    SUPPORTER: {
        weeklyReportsPerMonth: 15,
        explainRunsPerDay: 5,
    },
};

export function getLimit<K extends keyof TierLimits>(tier: SubscriptionTier, kind: K): TierLimits[K] {
    return TIER_LIMITS[tier][kind];
}
