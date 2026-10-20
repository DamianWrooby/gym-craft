import { describe, expect, it } from 'vitest';
import { evaluateWeek, strikeBudget } from './budget';

describe('strikeBudget', () => {
    it.each([
        { name: 'a full week', chronicLoad: 50, historyDays: 60, inHorizonDays: 7, outlookFactor: 1, budget: 455 },
        { name: 'a partial week', chronicLoad: 50, historyDays: 60, inHorizonDays: 3, outlookFactor: 1, budget: 195 },
        { name: 'a busy week', chronicLoad: 50, historyDays: 60, inHorizonDays: 7, outlookFactor: 0.85, budget: 386.8 },
        { name: 'exactly 28 days', chronicLoad: 10, historyDays: 28, inHorizonDays: 7, outlookFactor: 1, budget: 91 },
    ])('strikes 1.3 × chronic × days × outlook for $name', ({ budget, ...input }) => {
        expect(strikeBudget(input)).toBe(budget);
    });

    it.each([
        { name: 'under 28 days of history', chronicLoad: 50, historyDays: 27 },
        { name: 'no chronic load', chronicLoad: 0, historyDays: 90 },
        { name: 'a negative chronic load', chronicLoad: -1, historyDays: 90 },
    ])('is absent with $name', ({ chronicLoad, historyDays }) => {
        expect(strikeBudget({ chronicLoad, historyDays, inHorizonDays: 7, outlookFactor: 1 })).toBeNull();
    });
});

describe('evaluateWeek', () => {
    const sessions = [
        { plannedLoad: 100, method: 'LABEL_TABLE' as const },
        { plannedLoad: 90, method: 'DURATION' as const },
        { plannedLoad: 10, method: 'ATHLETE_ESTIMATE' as const },
    ];

    it('sums planned load and reports the fallback share', () => {
        expect(evaluateWeek(sessions, 250)).toEqual({
            plannedTotal: 200,
            remainder: 50,
            verdict: 'within',
            fallbackShare: 0.5,
        });
    });

    it('is over when planned load exceeds the budget, with a signed remainder', () => {
        expect(evaluateWeek(sessions, 150)).toMatchObject({ remainder: -50, verdict: 'over' });
    });

    it('is within at exactly the budget', () => {
        expect(evaluateWeek(sessions, 200).verdict).toBe('within');
    });

    it('has no verdict without a budget', () => {
        expect(evaluateWeek(sessions, null)).toEqual({
            plannedTotal: 200,
            remainder: null,
            verdict: null,
            fallbackShare: 0.5,
        });
    });

    it('reports no fallback share for an empty week', () => {
        expect(evaluateWeek([], 100).fallbackShare).toBe(0);
    });
});
