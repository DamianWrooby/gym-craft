import { describe, expect, it } from 'vitest';
import { deriveAnchor, type AnchorRun, type AnchorResult } from './anchor';

const today = '2026-10-12';

const result = (id: string, date: string, distanceM: number, timeSec: number): AnchorResult => ({
    id,
    date,
    distanceM,
    timeSec,
});
const run = (id: string, date: string, distanceM: number, durationSec: number): AnchorRun => ({
    id,
    date,
    distanceM,
    durationSec,
});

describe('deriveAnchor: entered race results', () => {
    it.each([
        ['marathon goal picks the half over the 5 km', 42195, 'half'],
        ['5 km goal picks the 5 km', 5000, '5k'],
        ['10 km goal picks the 5 km (closer than the half)', 10000, '5k'],
    ])('%s', (_, goalDistanceM, expectedId) => {
        const anchor = deriveAnchor({
            results: [result('5k', '2026-06-01', 5000, 1200), result('half', '2026-04-01', 21097, 5700)],
            runs: [],
            goalDistanceM,
            today,
        });
        expect(anchor).toMatchObject({ provenance: 'RACE_RESULT', sourceId: expectedId, stale: false });
    });

    it('uses the most recent result when the goal has no distance', () => {
        const anchor = deriveAnchor({
            results: [result('old', '2026-03-01', 10000, 2700), result('new', '2026-09-01', 5000, 1300)],
            runs: [],
            goalDistanceM: null,
            today,
        });
        expect(anchor?.sourceId).toBe('new');
    });

    it('ignores results older than 12 months when a fresh one exists', () => {
        const anchor = deriveAnchor({
            results: [result('ancient', '2025-10-01', 42195, 12600), result('fresh', '2026-05-01', 5000, 1200)],
            runs: [],
            goalDistanceM: 42195,
            today,
        });
        expect(anchor?.sourceId).toBe('fresh');
    });

    it('prefers any fresh result over runs', () => {
        const anchor = deriveAnchor({
            results: [result('r', '2026-01-01', 1500, 300)],
            runs: [run('fast', '2026-10-01', 10000, 2400)],
            goalDistanceM: 42195,
            today,
        });
        expect(anchor).toMatchObject({ provenance: 'RACE_RESULT', sourceId: 'r' });
    });
});

describe('deriveAnchor: inferred effort fallback', () => {
    it('picks the highest figure among runs of at least 5 km in 90 days', () => {
        const anchor = deriveAnchor({
            results: [],
            runs: [
                run('long-easy', '2026-10-05', 30000, 3 * 3600), // 6:00/km
                run('tempo', '2026-09-20', 8000, 2400), // 5:00/km over 8 km
                run('too-short', '2026-10-10', 4000, 900),
                run('too-old', '2026-06-01', 10000, 2200),
            ],
            goalDistanceM: 42195,
            today,
        });
        expect(anchor).toMatchObject({ provenance: 'INFERRED_EFFORT', sourceId: 'tempo', stale: false });
    });

    it('returns null with no result and no qualifying run', () => {
        expect(
            deriveAnchor({ results: [], runs: [run('x', '2026-10-01', 4999, 1500)], goalDistanceM: 5000, today }),
        ).toBeNull();
    });
});

describe('deriveAnchor: staleness', () => {
    it('keeps an aged-out result working, marked stale, when nothing fresh exists', () => {
        const anchor = deriveAnchor({
            results: [result('old', '2025-03-01', 10000, 2700)],
            runs: [],
            goalDistanceM: 10000,
            today,
        });
        expect(anchor).toMatchObject({ provenance: 'RACE_RESULT', sourceId: 'old', stale: true });
    });

    it('prefers a fresh inferred effort over a stale result', () => {
        const anchor = deriveAnchor({
            results: [result('old', '2025-03-01', 10000, 2700)],
            runs: [run('recent', '2026-10-01', 6000, 1800)],
            goalDistanceM: 10000,
            today,
        });
        expect(anchor).toMatchObject({ provenance: 'INFERRED_EFFORT', sourceId: 'recent' });
    });

    it('treats a result exactly 12 months old as fresh', () => {
        const anchor = deriveAnchor({
            results: [result('edge', '2025-10-12', 5000, 1200)],
            runs: [],
            goalDistanceM: 5000,
            today,
        });
        expect(anchor?.stale).toBe(false);
    });
});
