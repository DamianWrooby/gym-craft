import { describe, expect, it } from 'vitest';
import { computeDashboardSummary, type DashboardSummary, type DashboardSummaryActivity } from './dashboard-summary';
import type { ActivityModality } from '$lib/utils/activity-type';

const ASOF = new Date('2026-06-07T12:00:00Z'); // 7-day window: 2026-06-01 .. 2026-06-07

function run(startTime: string, distanceM: number | null, trimpLoad: number | null = 40): DashboardSummaryActivity {
    return { startTime, activityType: 'running', distanceM, trimpLoad };
}

function sevenDay(summary: DashboardSummary, modality: ActivityModality): number | undefined {
    return summary.distanceByModality.find((d) => d.modality === modality)?.sevenDayDistanceM;
}

function chronicDistance(summary: DashboardSummary, modality: ActivityModality): number | undefined {
    return summary.distanceByModality.find((d) => d.modality === modality)?.chronicDistanceM;
}

describe('computeDashboardSummary', () => {
    it('returns a neutral summary for empty history', () => {
        const summary = computeDashboardSummary([], ASOF, null);
        expect(summary.hasActivities).toBe(false);
        expect(summary.acwr).toBe(0);
        expect(summary.loadStatus).toBe('undertraining');
        expect(summary.sessions7d).toBe(0);
        expect(summary.monotony).toBe(0);
        expect(summary.monotonyIsHigh).toBe(false);
    });

    it('reports every modality even when empty, so the caller can gate tiles itself', () => {
        const summary = computeDashboardSummary([], ASOF, null);
        expect(summary.distanceByModality.map((d) => d.modality)).toEqual(['running', 'cycling', 'swimming', 'other']);
        expect(summary.distanceByModality.every((d) => d.sevenDayDistanceM === 0)).toBe(true);
        expect(summary.distanceByModality.every((d) => d.chronicDistanceM === 0)).toBe(true);
    });

    it('sums distance and counts sessions only within the last 7 days', () => {
        const summary = computeDashboardSummary(
            [
                run('2026-06-06T07:00:00Z', 5000),
                run('2026-06-02T07:00:00Z', 6000, 50),
                run('2026-05-20T07:00:00Z', 8000, 60),
            ],
            ASOF,
            new Date('2026-05-20T07:00:00Z'),
        );
        expect(summary.hasActivities).toBe(true);
        expect(sevenDay(summary, 'running')).toBe(11000);
        expect(summary.sessions7d).toBe(2);
    });

    it('never mixes distance across modalities', () => {
        const summary = computeDashboardSummary(
            [
                { startTime: '2026-06-06T07:00:00Z', activityType: 'running', distanceM: 10000, trimpLoad: 80 },
                { startTime: '2026-06-05T07:00:00Z', activityType: 'road_biking', distanceM: 40000, trimpLoad: 120 },
                { startTime: '2026-06-04T07:00:00Z', activityType: 'lap_swimming', distanceM: 2000, trimpLoad: 40 },
                { startTime: '2026-06-03T07:00:00Z', activityType: 'hiking', distanceM: 7000, trimpLoad: 60 },
            ],
            ASOF,
            new Date('2026-01-01T07:00:00Z'),
        );
        expect(sevenDay(summary, 'running')).toBe(10000);
        expect(sevenDay(summary, 'cycling')).toBe(40000);
        expect(sevenDay(summary, 'swimming')).toBe(2000);
        expect(sevenDay(summary, 'other')).toBe(7000);
        // All four modalities still count as sessions and toward systemic load.
        expect(summary.sessions7d).toBe(4);
    });

    it('tracks chronic distance beyond the 7-day tile window, so tiles stay stable across a quiet week', () => {
        const summary = computeDashboardSummary(
            [
                run('2026-06-06T07:00:00Z', 10000),
                // Rode 27 days ago, nothing this week: cycling has chronic distance but no 7-day distance.
                { startTime: '2026-05-12T07:00:00Z', activityType: 'cycling', distanceM: 40000, trimpLoad: 120 },
            ],
            ASOF,
            new Date('2026-01-01T07:00:00Z'),
        );
        expect(sevenDay(summary, 'cycling')).toBe(0);
        expect(chronicDistance(summary, 'cycling')).toBe(40000);
    });

    it('bounds chronic distance to 28 days, ignoring the caller window extra acute week', () => {
        // The caller queries 35 days (chronic + headroom for timezone edges at the boundary).
        // A ride 31 days ago is inside that query but outside the chronic window, so it must not
        // keep a Cycling tile on screen a week after it stopped counting toward chronic load.
        const summary = computeDashboardSummary(
            [
                run('2026-06-06T07:00:00Z', 10000),
                { startTime: '2026-05-08T07:00:00Z', activityType: 'cycling', distanceM: 40000, trimpLoad: 120 },
            ],
            ASOF,
            new Date('2026-01-01T07:00:00Z'),
        );
        expect(chronicDistance(summary, 'cycling')).toBe(0);
        // Still counted toward load, which is what the extra week of headroom is for.
        expect(summary.acwr).toBeGreaterThan(0);
    });

    it('leaves distance-free modalities at zero chronic distance so their tile stays hidden', () => {
        const summary = computeDashboardSummary(
            [
                run('2026-06-06T07:00:00Z', 10000),
                // A runner who lifts: strength has load and sessions, but no distance to report.
                {
                    startTime: '2026-06-05T07:00:00Z',
                    activityType: 'strength_training',
                    distanceM: null,
                    trimpLoad: 30,
                },
            ],
            ASOF,
            new Date('2026-01-01T07:00:00Z'),
        );
        expect(chronicDistance(summary, 'other')).toBe(0);
        expect(summary.sessions7d).toBe(2);
    });

    it('treats null trimpLoad as zero load but still counts the session and distance', () => {
        const summary = computeDashboardSummary(
            [run('2026-06-06T07:00:00Z', 5000, null)],
            ASOF,
            new Date('2026-06-06T07:00:00Z'),
        );
        expect(summary.sessions7d).toBe(1);
        expect(sevenDay(summary, 'running')).toBe(5000);
        expect(summary.monotony).toBe(0);
        expect(summary.acwr).toBe(0);
    });

    it('flags sufficient history once the earliest activity is at least 28 days old', () => {
        const summary = computeDashboardSummary(
            [run('2026-06-06T07:00:00Z', 5000)],
            ASOF,
            new Date('2026-05-01T07:00:00Z'),
        );
        expect(summary.hasSufficientHistory).toBe(true);
    });

    it('flags insufficient history when the earliest activity is more recent than 28 days', () => {
        const summary = computeDashboardSummary(
            [run('2026-06-06T07:00:00Z', 5000)],
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
            [run('2026-06-06T07:00:00Z', 5000)],
            ASOF,
            new Date('2024-01-15T07:00:00Z'),
        );
        expect(summary.hasSufficientHistory).toBe(true);
    });
});
