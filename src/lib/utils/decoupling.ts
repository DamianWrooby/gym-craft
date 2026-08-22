import type { ActivitySample } from '$lib/server/garmin/fetch-activity-detail';

/**
 * Aerobic decoupling (Pw:HR / pace:HR drift). Splits the effort in half by time and compares
 * the speed-to-HR efficiency of each half. Positive = the second half cost more HR per unit
 * speed (cardiac drift). Returns null when there is not enough usable data.
 * Modality-agnostic in maths, but only meaningful for steady aerobic efforts — callers gate
 * to the running modality per CONTEXT.md.
 */
export function computeAerobicDecoupling(samples: ActivitySample[]): number | null {
    const usable = samples.filter((s) => s.heartRate != null && s.heartRate > 0 && s.speed != null && s.speed > 0);
    if (usable.length < 4) return null;

    const mid = Math.floor(usable.length / 2);
    const eff1 = meanEfficiency(usable.slice(0, mid));
    const eff2 = meanEfficiency(usable.slice(mid));
    if (eff1 == null || eff2 == null || eff1 === 0) return null;

    return roundTo1(((eff1 - eff2) / eff1) * 100);
}

function meanEfficiency(samples: ActivitySample[]): number | null {
    const ratios = samples.map((s) => (s.speed as number) / (s.heartRate as number));
    if (ratios.length === 0) return null;
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

function roundTo1(n: number): number {
    return Math.round(n * 10) / 10;
}
