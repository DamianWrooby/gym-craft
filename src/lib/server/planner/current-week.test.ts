import { describe, expect, it } from 'vitest';
import { weekOn } from './current-week';

describe('weekOn', () => {
    const week = (id: string, start: string, end: string) => ({
        id,
        startDate: new Date(`${start}T00:00:00Z`),
        endDate: new Date(`${end}T00:00:00Z`),
    });
    const phases = [
        { id: 'p1', weeks: [week('w1', '2026-10-12', '2026-10-18')] },
        { id: 'p2', weeks: [week('w2', '2026-10-19', '2026-10-25')] },
    ];

    it('finds the week and phase that hold the day, ends included', () => {
        expect(weekOn(phases, '2026-10-19')).toEqual({ phase: phases[1], week: phases[1].weeks[0] });
        expect(weekOn(phases, '2026-10-18')?.week.id).toBe('w1');
    });

    it('returns null outside the plan', () => {
        expect(weekOn(phases, '2026-10-26')).toBeNull();
    });
});
