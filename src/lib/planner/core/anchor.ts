// Anchor selection (ADR 0010). Pure: race results and runs in, one anchor out. Never stored.
import { addDays } from '$lib/utils/iso-week';

export interface AnchorResult {
    id: string;
    date: string; // YYYY-MM-DD
    distanceM: number;
    timeSec: number;
}

export interface AnchorRun {
    id: string;
    date: string; // YYYY-MM-DD
    distanceM: number;
    /** Whole-activity moving time. */
    durationSec: number;
}

export type AnchorProvenance = 'RACE_RESULT' | 'INFERRED_EFFORT';

export interface Anchor {
    provenance: AnchorProvenance;
    sourceId: string;
    date: string;
    distanceM: number;
    timeSec: number;
    /** The source aged out of its window; targets keep working and the athlete is prompted. */
    stale: boolean;
}

export interface AnchorInput {
    results: AnchorResult[];
    runs: AnchorRun[];
    goalDistanceM: number | null;
    today: string;
}

const MIN_INFERRED_DISTANCE_M = 5000;
const INFERRED_WINDOW_DAYS = 90;

/** Daniels/Gilbert oxygen-cost relation: compares efforts across distances. */
export function vdot(distanceM: number, timeSec: number): number {
    const t = timeSec / 60;
    const v = distanceM / t;
    const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
    const pctMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
    return vo2 / pctMax;
}

function oneYearBefore(today: string): string {
    const [y, m, d] = today.split('-');
    return `${Number(y) - 1}-${m}-${d}`;
}

function pickEntered(results: AnchorResult[], goalDistanceM: number | null): AnchorResult {
    const byRecency = [...results].sort((a, b) => b.date.localeCompare(a.date));
    if (goalDistanceM == null) return byRecency[0];
    // Stable sort keeps the more recent result first on equal distance gaps.
    return byRecency.sort((a, b) => Math.abs(a.distanceM - goalDistanceM) - Math.abs(b.distanceM - goalDistanceM))[0];
}

function toAnchor(r: AnchorResult, stale: boolean): Anchor {
    return {
        provenance: 'RACE_RESULT',
        sourceId: r.id,
        date: r.date,
        distanceM: r.distanceM,
        timeSec: r.timeSec,
        stale,
    };
}

export function deriveAnchor({ results, runs, goalDistanceM, today }: AnchorInput): Anchor | null {
    const yearAgo = oneYearBefore(today);
    const fresh = results.filter((r) => r.date >= yearAgo && r.date <= today);
    if (fresh.length > 0) return toAnchor(pickEntered(fresh, goalDistanceM), false);

    const inferredFrom = addDays(today, -INFERRED_WINDOW_DAYS);
    const candidates = runs.filter(
        (r) => r.distanceM >= MIN_INFERRED_DISTANCE_M && r.durationSec > 0 && r.date >= inferredFrom && r.date <= today,
    );
    if (candidates.length > 0) {
        const best = candidates.reduce((a, b) =>
            vdot(b.distanceM, b.durationSec) > vdot(a.distanceM, a.durationSec) ? b : a,
        );
        return {
            provenance: 'INFERRED_EFFORT',
            sourceId: best.id,
            date: best.date,
            distanceM: best.distanceM,
            timeSec: best.durationSec,
            stale: false,
        };
    }

    const past = results.filter((r) => r.date <= today);
    if (past.length > 0) return toAnchor(pickEntered(past, goalDistanceM), true);
    return null;
}
