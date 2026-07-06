import { describe, expect, it } from 'vitest';
import { TIER_LIMITS, getLimit } from './subscription.constants';

describe('TIER_LIMITS', () => {
    it('encodes the agreed FREE caps', () => {
        expect(TIER_LIMITS.FREE.weeklyReportsPerMonth).toBe(2);
        expect(TIER_LIMITS.FREE.explainRunsPerDay).toBe(1);
        expect(TIER_LIMITS.FREE.gymPlansPerMonth).toBeNull();
        expect(TIER_LIMITS.FREE.garminBackfillDays).toBe(60);
        expect(TIER_LIMITS.FREE.aiModel).toBe('gpt-5.4-mini');
    });

    it('encodes the agreed SUPPORTER caps', () => {
        expect(TIER_LIMITS.SUPPORTER.weeklyReportsPerMonth).toBe(15);
        expect(TIER_LIMITS.SUPPORTER.explainRunsPerDay).toBe(5);
        expect(TIER_LIMITS.SUPPORTER.gymPlansPerMonth).toBe(5);
        expect(TIER_LIMITS.SUPPORTER.garminBackfillDays).toBe(120);
        expect(TIER_LIMITS.SUPPORTER.aiModel).toBe('gpt-5.4');
    });
});

describe('getLimit', () => {
    it('returns the cap for a tier + kind', () => {
        expect(getLimit('FREE', 'weeklyReportsPerMonth')).toBe(2);
        expect(getLimit('SUPPORTER', 'explainRunsPerDay')).toBe(5);
    });
});
