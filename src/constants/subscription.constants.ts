export type SubscriptionTier = 'FREE' | 'SUPPORTER';

// Single source of truth for tier gating.
// gymPlansPerMonth: null means the legacy lifetime cap applies
// (Configuration generalPlanLimit − User.generatedPlansNumber).
export interface TierLimits {
    weeklyReportsPerMonth: number;
    explainRunsPerDay: number;
    gymPlansPerMonth: number | null;
    garminBackfillDays: number;
    // Model for weekly reports and explain-run. Must be listed in `allowedModels` in the
    // proxy's app/config/openAI.config.js, or the proxy silently falls back to its default.
    // Gym-plan generation ignores this and always uses the proxy default (ADR 0005: its
    // request is browser-built, so a client-sent model would be spoofable).
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
