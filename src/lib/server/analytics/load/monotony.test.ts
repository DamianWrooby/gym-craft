import { describe, it, expect } from 'vitest';
import { buildDailyLoadMap } from './acwr';
import { computeMonotony, computeStrain } from './monotony';

const asOf = new Date('2026-05-19T00:00:00Z');

describe('computeMonotony', () => {
    it('returns 0 when all daily loads are zero', () => {
        const map = buildDailyLoadMap([]);
        expect(computeMonotony(map, asOf)).toBe(0);
    });

    it('returns Infinity when loads are positive but identical every day', () => {
        const map = buildDailyLoadMap([
            { date: '2026-05-13', load: 50 },
            { date: '2026-05-14', load: 50 },
            { date: '2026-05-15', load: 50 },
            { date: '2026-05-16', load: 50 },
            { date: '2026-05-17', load: 50 },
            { date: '2026-05-18', load: 50 },
            { date: '2026-05-19', load: 50 },
        ]);
        expect(computeMonotony(map, asOf)).toBe(Infinity);
    });

    it('returns a finite positive value when loads vary', () => {
        const map = buildDailyLoadMap([
            { date: '2026-05-13', load: 100 },
            { date: '2026-05-14', load: 50 },
            { date: '2026-05-15', load: 0 },
            { date: '2026-05-16', load: 0 },
            { date: '2026-05-17', load: 70 },
            { date: '2026-05-18', load: 30 },
            { date: '2026-05-19', load: 20 },
        ]);
        const value = computeMonotony(map, asOf);
        expect(value).toBeGreaterThan(0);
        expect(isFinite(value)).toBe(true);
    });

    it('higher monotony when loads are more uniform', () => {
        const uniformish = buildDailyLoadMap([
            { date: '2026-05-13', load: 48 },
            { date: '2026-05-14', load: 50 },
            { date: '2026-05-15', load: 52 },
            { date: '2026-05-16', load: 49 },
            { date: '2026-05-17', load: 51 },
            { date: '2026-05-18', load: 50 },
            { date: '2026-05-19', load: 50 },
        ]);
        const spiky = buildDailyLoadMap([
            { date: '2026-05-13', load: 0 },
            { date: '2026-05-14', load: 200 },
            { date: '2026-05-15', load: 0 },
            { date: '2026-05-16', load: 0 },
            { date: '2026-05-17', load: 150 },
            { date: '2026-05-18', load: 0 },
            { date: '2026-05-19', load: 0 },
        ]);
        expect(computeMonotony(uniformish, asOf)).toBeGreaterThan(computeMonotony(spiky, asOf));
    });
});

describe('computeStrain', () => {
    it('multiplies weekly load by monotony', () => {
        expect(computeStrain(350, 2)).toBe(700);
    });

    it('handles Infinity monotony by returning weekly load alone', () => {
        expect(computeStrain(350, Infinity)).toBe(350);
    });
});
