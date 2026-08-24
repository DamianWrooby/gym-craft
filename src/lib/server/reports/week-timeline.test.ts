import { describe, it, expect } from 'vitest';
import { buildWeekTimeline, enumerateWeeks, trainingWeekStarts } from './week-timeline';

describe('enumerateWeeks', () => {
    it('returns count weeks, newest first, snapped to Mondays', () => {
        // 2026-08-24 is a Monday.
        const weeks = enumerateWeeks('2026-08-26', 3);
        expect(weeks).toEqual([
            { periodStart: '2026-08-24', periodEnd: '2026-08-30' },
            { periodStart: '2026-08-17', periodEnd: '2026-08-23' },
            { periodStart: '2026-08-10', periodEnd: '2026-08-16' },
        ]);
    });
});

describe('trainingWeekStarts', () => {
    it('buckets by Monday and excludes walking, keeps hiking', () => {
        const starts = trainingWeekStarts([
            { startTime: '2026-08-25T06:00:00Z', activityType: 'running' },
            { startTime: '2026-08-19T06:00:00Z', activityType: 'walking' },
            { startTime: '2026-08-18T06:00:00Z', activityType: 'hiking' },
        ]);
        expect(starts.has('2026-08-24')).toBe(true); // running
        expect(starts.has('2026-08-17')).toBe(true); // hiking, not the walk
        expect(starts.size).toBe(2);
    });

    it('a walk-only week is not a training week', () => {
        const starts = trainingWeekStarts([{ startTime: '2026-08-19T06:00:00Z', activityType: 'casual_walking' }]);
        expect(starts.size).toBe(0);
    });
});

describe('buildWeekTimeline', () => {
    const base = { asOf: '2026-08-26', count: 3 };

    it('marks report / gap / empty correctly', () => {
        const cells = buildWeekTimeline({
            ...base,
            reports: [
                {
                    id: 'r1',
                    periodStart: '2026-08-24',
                    acwrStatus: 'optimal',
                    weeklyTotalLoad: 210.5,
                    monotonyIsHigh: false,
                },
            ],
            activities: [{ startTime: '2026-08-18T06:00:00Z', activityType: 'running' }],
        });

        expect(cells.map((c) => c.state)).toEqual(['report', 'gap', 'empty']);
        expect(cells[0]).toMatchObject({ reportId: 'r1', acwrStatus: 'optimal', weeklyTotalLoad: 210.5 });
        expect(cells[1]).toMatchObject({ reportId: null, weeklyTotalLoad: null });
    });

    it('a week with both a report and training is a report cell, not a gap', () => {
        const cells = buildWeekTimeline({
            ...base,
            reports: [
                {
                    id: 'r1',
                    periodStart: '2026-08-24',
                    acwrStatus: 'overreach',
                    weeklyTotalLoad: 300,
                    monotonyIsHigh: true,
                },
            ],
            activities: [{ startTime: '2026-08-25T06:00:00Z', activityType: 'running' }],
        });
        expect(cells[0].state).toBe('report');
    });
});
