export type SubscriptionTier = 'FREE' | 'SUPPORTER';

// Single source of truth for tier gating.
// gymPlansPerMonth: null means the legacy lifetime cap applies
// (Configuration generalPlanLimit − User.generatedPlansNumber).
export interface TierLimits {
    weeklyReportsPerMonth: number;
    explainRunsPerDay: number;
    gymPlansPerMonth: number | null;
    garminBackfillDays: number;
    // Monthly cap on AI plan revisions (AiUsage kind 'plan_revision'). Pulls are uncapped (ADR 0016).
    planRevisionsPerMonth: number;
    // Default for the account-wide AI model setting, used by every AI feature. Must be listed in
    // `allowedModels` in the proxy's app/config/openAI.config.js, or the proxy silently falls back
    // to its default. The legacy browser-built gym planner ignores it (ADR 0016).
    aiModel: string;
    // Models the athlete may pick in the AI model setting. Includes `aiModel`.
    allowedModels: readonly string[];
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
        planRevisionsPerMonth: 4,
        aiModel: 'gpt-5.4-mini',
        allowedModels: ['gpt-5.4-mini'],
    },
    SUPPORTER: {
        weeklyReportsPerMonth: 15,
        explainRunsPerDay: 5,
        gymPlansPerMonth: 5,
        garminBackfillDays: 120,
        planRevisionsPerMonth: 30,
        aiModel: 'gpt-5.4',
        allowedModels: ['gpt-5.4', 'gpt-5.4-mini'],
    },
};

export function getLimit<K extends keyof TierLimits>(tier: SubscriptionTier, kind: K): TierLimits[K] {
    return TIER_LIMITS[tier][kind];
}

/**
 * The model every AI call uses: the athlete's stored preference when the current tier allows it,
 * else the tier default. A lapsed supporter's stored `gpt-5.4` therefore resolves to the FREE model.
 */
export function resolveAiModel(tier: SubscriptionTier, preference: string | null | undefined): string {
    const limits = TIER_LIMITS[tier];
    return preference && limits.allowedModels.includes(preference) ? preference : limits.aiModel;
}
