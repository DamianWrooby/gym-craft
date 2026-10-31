import { describe, expect, it } from 'vitest';
import { tuneUpFixtures } from './fixtures';

const weeks = [
    { index: 0, startDate: '2026-10-12', endDate: '2026-10-18' },
    { index: 1, startDate: '2026-10-19', endDate: '2026-10-25' },
];

describe('tuneUpFixtures', () => {
    it('places other dated goals inside the horizon on their week, excluding the bound goal', () => {
        const goals = [
            { id: 'bound', date: '2026-10-25', name: 'Main race', distanceM: 21097 },
            { id: 'tune', date: '2026-10-20', name: 'Club 10K', distanceM: 10000 },
            { id: 'before', date: '2026-10-10', name: 'Too early', distanceM: 5000 },
            { id: 'after', date: '2026-11-01', name: 'Too late', distanceM: 5000 },
            { id: 'undated', date: null, name: 'Base', distanceM: null },
        ];
        expect(
            tuneUpFixtures({ goals, boundGoalId: 'bound', startDate: '2026-10-14', endDate: '2026-10-25', weeks }),
        ).toEqual([{ goalId: 'tune', date: '2026-10-20', name: 'Club 10K', distanceM: 10000, weekIndex: 1 }]);
    });

    it('ignores a goal dated before the horizon start inside the opening week', () => {
        const goals = [{ id: 'g', date: '2026-10-13', name: 'x', distanceM: null }];
        expect(
            tuneUpFixtures({ goals, boundGoalId: 'b', startDate: '2026-10-14', endDate: '2026-10-25', weeks }),
        ).toEqual([]);
    });
});
