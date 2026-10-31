// Recommendation table (ADR 0019, #380 §7). First match wins. Rows naming a school the
// catalogue does not ship yet (Lydiard) are kept so they activate when it lands.
import { m } from '$lib/paraglide/messages.js';
import { judged } from './types';

export interface RecommendationRule {
    schoolId: string;
    /** A message, so the reason reads in the locale of the request that recommends. */
    reason: () => string;
    when: {
        anchorPresent?: boolean;
        goalMinM?: number;
        goalMaxM?: number;
        horizonMinWeeks?: number;
        horizonMaxWeeks?: number;
        recentMinMetres?: number;
    };
}

export const RECOMMENDATION_RULES = judged<RecommendationRule[]>(
    [
        { schoolId: 'POLARIZED', reason: m.recommend_hr_alone, when: { anchorPresent: false } },
        {
            schoolId: 'PFITZINGER',
            reason: m.recommend_marathon,
            when: { goalMinM: 42195, horizonMinWeeks: 12, horizonMaxWeeks: 20, recentMinMetres: 24000 },
        },
        {
            schoolId: 'LYDIARD',
            reason: m.recommend_full_base,
            when: { horizonMinWeeks: 23, goalMinM: 10000 },
        },
        {
            schoolId: 'DANIELS',
            reason: m.recommend_race_paces,
            when: { goalMaxM: 21097, horizonMinWeeks: 8 },
        },
        { schoolId: 'POLARIZED', reason: m.recommend_flexible, when: {} },
    ],
    'Every row is GymCraft judgement (#380 §7).',
);
