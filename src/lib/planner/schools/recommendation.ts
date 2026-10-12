// Recommendation table (ADR 0019, #380 §7). First match wins. Rows naming a school the
// catalogue does not ship yet (Pfitzinger, Lydiard) are kept so they activate when it lands.
import { judged } from './types';

export interface RecommendationRule {
    schoolId: string;
    reason: string;
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
        { schoolId: 'POLARIZED', reason: 'Works from heart rate alone.', when: { anchorPresent: false } },
        {
            schoolId: 'PFITZINGER',
            reason: 'Built for the marathon, 12–18 weeks.',
            when: { goalMinM: 42195, horizonMinWeeks: 12, horizonMaxWeeks: 20, recentMinMetres: 24000 },
        },
        {
            schoolId: 'LYDIARD',
            reason: 'You have time for a full base.',
            when: { horizonMinWeeks: 23, goalMinM: 10000 },
        },
        {
            schoolId: 'DANIELS',
            reason: 'Paces set from your race result.',
            when: { goalMaxM: 21097, horizonMinWeeks: 8 },
        },
        { schoolId: 'POLARIZED', reason: 'Flexible and forgiving.', when: {} },
    ],
    'Every row is GymCraft judgement (#380 §7).',
);
