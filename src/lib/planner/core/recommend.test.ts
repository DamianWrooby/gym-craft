import { describe, expect, it } from 'vitest';
import { recommendSchool, type RecommendInput } from './recommend';

const base: RecommendInput = {
    goal: { isRace: true, distanceM: 21097 },
    horizonWeeks: 16,
    anchorPresent: true,
    recentMetresPerWeek: 30000,
};

describe('recommendSchool', () => {
    it.each([
        ['no anchor → polarized', { anchorPresent: false }, 'POLARIZED', 'Works from heart rate alone.'],
        ['half marathon with a result → Daniels', {}, 'DANIELS', 'Paces set from your race result.'],
        [
            'marathon, 16 weeks, 30 km a week → Pfitzinger',
            { goal: { isRace: true, distanceM: 42195 } },
            'PFITZINGER',
            'Built for the marathon, 12–18 weeks.',
        ],
        [
            'marathon below 24 km a week → polarized fallback',
            { goal: { isRace: true, distanceM: 42195 }, recentMetresPerWeek: 20000 },
            'POLARIZED',
            'Flexible and forgiving.',
        ],
        [
            'marathon over 20 weeks → polarized fallback',
            { goal: { isRace: true, distanceM: 42195 }, horizonWeeks: 21 },
            'POLARIZED',
            'Flexible and forgiving.',
        ],
        [
            'undated goal with a result → polarized fallback',
            { goal: { isRace: false, distanceM: null } },
            'POLARIZED',
            'Flexible and forgiving.',
        ],
    ])('%s', (_, overrides, schoolId, reason) => {
        expect(recommendSchool({ ...base, ...overrides }).recommended).toEqual({ schoolId, reason });
    });

    it('filters schools whose floor exceeds the horizon, with a reason', () => {
        const r = recommendSchool({ ...base, horizonWeeks: 8 });
        expect(r.offered).toEqual(['DANIELS']);
        expect(r.filtered).toEqual([
            { schoolId: 'POLARIZED', reason: 'Needs at least 9 weeks; your horizon has 8.' },
            { schoolId: 'PFITZINGER', reason: 'Needs at least 12 weeks; your horizon has 8.' },
        ]);
        expect(r.recommended).toEqual({ schoolId: 'DANIELS', reason: 'Paces set from your race result.' });
    });

    it('falls back to the first offered school when the matched one is filtered', () => {
        const r = recommendSchool({ ...base, horizonWeeks: 8, anchorPresent: false });
        expect(r.recommended?.schoolId).toBe('DANIELS');
        expect(r.recommended?.reason).toBeTruthy();
    });

    it('filters Pfitzinger below its 12-week floor, so a short marathon falls back', () => {
        const r = recommendSchool({ ...base, goal: { isRace: true, distanceM: 42195 }, horizonWeeks: 11 });
        expect(r.offered).toEqual(['POLARIZED', 'DANIELS']);
        expect(r.filtered).toEqual([
            { schoolId: 'PFITZINGER', reason: 'Needs at least 12 weeks; your horizon has 11.' },
        ]);
        expect(r.recommended?.schoolId).toBe('POLARIZED');
    });

    it('recommends nothing when every school is filtered', () => {
        const r = recommendSchool({ ...base, horizonWeeks: 5 });
        expect(r.recommended).toBeNull();
        expect(r.offered).toEqual([]);
        expect(r.filtered).toHaveLength(3);
    });
});
