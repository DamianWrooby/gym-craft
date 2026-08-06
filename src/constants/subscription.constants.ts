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

/**
 * Mirror of `allowedModels` in the AI proxy (`app/config/openAI.config.js`). An id the proxy does
 * not recognise is not an error there — it logs a warning and quietly falls back to its default,
 * so a typo would silently downgrade paying users. Keeping the list here lets a test catch that
 * before deploy; when a tier model changes, update the proxy's allowlist in the same change.
 */
export const PROXY_ALLOWED_MODELS = ['gpt-5.4-mini', 'gpt-5.4'] as const;

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
