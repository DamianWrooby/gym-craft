import { describe, expect, it } from 'vitest';
import { computeDashboardSummary } from './dashboard-summary';

const ASOF = new Date('2026-06-07T12:00:00Z'); // 7-day window: 2026-06-01 .. 2026-06-07

describe('computeDashboardSummary', () => {
    it('returns a neutral summary for empty history', () => {
        const summary = computeDashboardSummary([], ASOF);
        expect(summary.hasActivities).toBe(false);
        expect(summary.acwr).toBe(0);
        expect(summary.loadStatus).toBe('undertraining');
        expect(summary.sevenDayDistanceM).toBe(0);
        expect(summary.sessions7d).toBe(0);
        expect(summary.monotony).toBe(0);
        expect(summary.monotonyIsHigh).toBe(false);
    });

    it('sums distance and counts sessions only within the last 7 days', () => {
        const summary = computeDashboardSummary(
            [
                { startTime: '2026-06-06T07:00:00Z', distanceM: 5000, trimpLoad: 40 },
                { startTime: '2026-06-02T07:00:00Z', distanceM: 6000, trimpLoad: 50 },
                { startTime: '2026-05-20T07:00:00Z', distanceM: 8000, trimpLoad: 60 },
            ],
            ASOF,
        );
        expect(summary.hasActivities).toBe(true);
        expect(summary.sevenDayDistanceM).toBe(11000);
        expect(summary.sessions7d).toBe(2);
    });

    it('treats null trimpLoad as zero load but still counts the session and distance', () => {
        const summary = computeDashboardSummary(
            [{ startTime: '2026-06-06T07:00:00Z', distanceM: 5000, trimpLoad: null }],
            ASOF,
        );
        expect(summary.sessions7d).toBe(1);
        expect(summary.sevenDayDistanceM).toBe(5000);
        expect(summary.monotony).toBe(0);
        expect(summary.acwr).toBe(0);
    });
});
