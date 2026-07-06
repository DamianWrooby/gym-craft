export type SubscriptionTier = 'FREE' | 'SUPPORTER';

// Single source of truth for tier gating.
// gymPlansPerMonth: null means the legacy lifetime cap applies
// (Configuration generalPlanLimit − User.generatedPlansNumber).
export interface TierLimits {
    weeklyReportsPerMonth: number;
    explainRunsPerDay: number;
    gymPlansPerMonth: number | null;
    garminBackfillDays: number;
    aiModel: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
    FREE: {
        weeklyReportsPerMonth: 2,
        explainRunsPerDay: 1,
        gymPlansPerMonth: null,
        garminBackfillDays: 60,
        aiModel: 'gpt-5.4-mini',
    },
    SUPPORTER: {
        weeklyReportsPerMonth: 15,
        explainRunsPerDay: 5,
        gymPlansPerMonth: 5,
        garminBackfillDays: 120,
        aiModel: 'gpt-5.4',
    },
};

export function getLimit<K extends keyof TierLimits>(tier: SubscriptionTier, kind: K): TierLimits[K] {
    return TIER_LIMITS[tier][kind];
}
