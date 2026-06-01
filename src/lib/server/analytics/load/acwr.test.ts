import { describe, it, expect } from 'vitest';
import {
    buildDailyLoadMap,
    computeAverageDailyLoad,
    computeWindowTotalLoad,
    computeAcwr,
    enumerateDates,
} from './acwr';

const asOf = new Date('2026-05-19T00:00:00Z');

describe('buildDailyLoadMap', () => {
    it('aggregates multiple entries on the same day', () => {
        const map = buildDailyLoadMap([
            { date: '2026-05-19', load: 30 },
            { date: '2026-05-19', load: 20 },
            { date: '2026-05-18', load: 50 },
        ]);
        expect(map.get('2026-05-19')).toBe(50);
        expect(map.get('2026-05-18')).toBe(50);
    });
});

describe('enumerateDates', () => {
    it('returns N consecutive ISO dates ending at asOf', () => {
        const dates = enumerateDates(asOf, 7);
        expect(dates).toHaveLength(7);
        expect(dates[0]).toBe('2026-05-13');
        expect(dates[6]).toBe('2026-05-19');
    });
});

describe('computeAverageDailyLoad', () => {
    it('returns 0 when no loads in window', () => {
        const map = buildDailyLoadMap([]);
        expect(computeAverageDailyLoad(map, asOf, 7)).toBe(0);
    });

    it('averages loads across the window including zero days', () => {
        const map = buildDailyLoadMap([
            { date: '2026-05-19', load: 70 },
            { date: '2026-05-18', load: 0 },
            { date: '2026-05-17', load: 0 },
            { date: '2026-05-16', load: 0 },
            { date: '2026-05-15', load: 0 },
            { date: '2026-05-14', load: 0 },
            { date: '2026-05-13', load: 0 },
        ]);
        expect(computeAverageDailyLoad(map, asOf, 7)).toBe(10);
    });

    it('ignores loads outside the window', () => {
        const map = buildDailyLoadMap([
            { date: '2026-05-01', load: 1000 },
            { date: '2026-05-19', load: 70 },
        ]);
        expect(computeAverageDailyLoad(map, asOf, 7)).toBe(10);
    });
});

describe('computeWindowTotalLoad', () => {
    it('sums loads within the window', () => {
        const map = buildDailyLoadMap([
            { date: '2026-05-19', load: 50 },
            { date: '2026-05-18', load: 30 },
            { date: '2026-05-17', load: 20 },
        ]);
        expect(computeWindowTotalLoad(map, asOf, 7)).toBe(100);
    });
});

describe('computeAcwr', () => {
    it('returns 0 when chronic load is 0', () => {
        expect(computeAcwr(50, 0)).toBe(0);
    });

    it('returns 1.0 when acute equals chronic', () => {
        expect(computeAcwr(50, 50)).toBe(1);
    });

    it('returns >1 when acute exceeds chronic', () => {
        expect(computeAcwr(60, 50)).toBeCloseTo(1.2, 5);
    });

    it('returns <1 when acute is below chronic', () => {
        expect(computeAcwr(40, 50)).toBeCloseTo(0.8, 5);
    });
});
