import { describe, expect, it } from 'vitest';
import { computeDashboardSummary } from './dashboard-summary';

const ASOF = new Date('2026-06-07T12:00:00Z'); // 7-day window: 2026-06-01 .. 2026-06-07

describe('computeDashboardSummary', () => {
    it('returns a neutral summary for empty history', () => {
        const summary = computeDashboardSummary([], ASOF, null);
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
            new Date('2026-05-20T07:00:00Z'),
        );
        expect(summary.hasActivities).toBe(true);
        expect(summary.sevenDayDistanceM).toBe(11000);
        expect(summary.sessions7d).toBe(2);
    });

    it('treats null trimpLoad as zero load but still counts the session and distance', () => {
        const summary = computeDashboardSummary(
            [{ startTime: '2026-06-06T07:00:00Z', distanceM: 5000, trimpLoad: null }],
            ASOF,
            new Date('2026-06-06T07:00:00Z'),
        );
        expect(summary.sessions7d).toBe(1);
        expect(summary.sevenDayDistanceM).toBe(5000);
        expect(summary.monotony).toBe(0);
        expect(summary.acwr).toBe(0);
    });

    it('flags sufficient history once the earliest activity is at least 28 days old', () => {
        const summary = computeDashboardSummary(
            [{ startTime: '2026-06-06T07:00:00Z', distanceM: 5000, trimpLoad: 40 }],
            ASOF,
            new Date('2026-05-01T07:00:00Z'),
        );
        expect(summary.hasSufficientHistory).toBe(true);
    });

    it('flags insufficient history when the earliest activity is more recent than 28 days', () => {
        const summary = computeDashboardSummary(
            [{ startTime: '2026-06-06T07:00:00Z', distanceM: 5000, trimpLoad: 40 }],
            ASOF,
            new Date('2026-06-06T07:00:00Z'),
        );
        expect(summary.hasSufficientHistory).toBe(false);
    });

    it('flags insufficient history for empty history', () => {
        const summary = computeDashboardSummary([], ASOF, null);
        expect(summary.hasSufficientHistory).toBe(false);
    });

    it('reports sufficient history from the earliest activity, not the oldest one in the window', () => {
        // An athlete who trained long ago, paused, and came back: every activity inside
        // the load window is recent, but they are not a new athlete. This is exactly the
        // case the caller's separate _min(startTime) query exists to answer correctly.
        const summary = computeDashboardSummary(
            [{ startTime: '2026-06-06T07:00:00Z', distanceM: 5000, trimpLoad: 40 }],
            ASOF,
            new Date('2024-01-15T07:00:00Z'),
        );
        expect(summary.hasSufficientHistory).toBe(true);
    });
});
