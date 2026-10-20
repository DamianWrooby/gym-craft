// Step targets (ADR 0009): derived from the intensity label. Pace labels read the anchor, heart-rate
// labels read the athlete's zones. The two are never converted into each other.
import { judged, type SchoolDefinition } from '../schools/types';
import type { HrZoneBound } from './zones';
import { vdot as vdotOf } from './anchor';
import { isRepeat, type RunBlock, type StepTarget, type TypedSession } from './session';

/**
 * Daniels labels as fractions of VO2max (low, high). Judged from the published VDOT tables:
 * the fractions reproduce the table paces within a few seconds per km around VDOT 40–60.
 */
export const DANIELS_VO2_FRACTIONS = judged<Record<string, [number, number]>>({
    E: [0.62, 0.7],
    M: [0.8, 0.84],
    T: [0.86, 0.89],
    I: [0.95, 1.0],
    R: [1.04, 1.08],
});

/** Heart-rate labels as athlete zone ranges (first, last). Seiler's three zones on a five-zone model. */
export const HR_LABEL_ZONES = judged<Record<string, [number, number]>>({
    z1: [1, 2],
    z2: [3, 3],
    z3: [4, 5],
});

function secPerKmAt(vo2: number): number {
    // Solve 0.000104 v² + 0.182258 v − (4.6 + vo2) = 0 for v in m/min.
    const v = (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (4.6 + vo2))) / (2 * 0.000104);
    return Math.round(60000 / v);
}

function paceRange(school: SchoolDefinition, anchor: AnchorEffort, label: string) {
    const fractions = school.id === 'DANIELS' ? DANIELS_VO2_FRACTIONS.value[label] : undefined;
    if (!fractions) return null;
    const vdot = vdotOf(anchor.distanceM, anchor.timeSec);
    // A higher fraction is a faster pace, so the high fraction gives the minimum seconds per km.
    return { minSecPerKm: secPerKmAt(vdot * fractions[1]), maxSecPerKm: secPerKmAt(vdot * fractions[0]) };
}

export interface AnchorEffort {
    distanceM: number;
    timeSec: number;
}

/** Mid-range pace per pace label, used to cost distance steps. Null when nothing can supply it. */
export function labelPaces(school: SchoolDefinition, anchor: AnchorEffort | null): Record<string, number> | null {
    if (!anchor) return null;
    const paces: Record<string, number> = {};
    for (const label of school.intensityLabels) {
        if (label.targetType.value !== 'PACE') continue;
        const range = paceRange(school, anchor, label.key);
        if (range) paces[label.key] = Math.round((range.minSecPerKm + range.maxSecPerKm) / 2);
    }
    return Object.keys(paces).length > 0 ? paces : null;
}

export interface TargetContext {
    school: SchoolDefinition;
    anchor: AnchorEffort | null;
    zones: HrZoneBound[] | null;
}

function targetFor(labelKey: string, ctx: TargetContext): StepTarget | null {
    const label = ctx.school.intensityLabels.find((l) => l.key === labelKey);
    if (!label) return null;
    if (label.targetType.value === 'PACE') {
        const range = ctx.anchor ? paceRange(ctx.school, ctx.anchor, labelKey) : null;
        return range ? { type: 'PACE', ...range } : null;
    }
    const span = HR_LABEL_ZONES.value[labelKey];
    const lower = ctx.zones?.find((z) => z.zone === span?.[0]);
    const upper = ctx.zones?.find((z) => z.zone === span?.[1]);
    return lower && upper ? { type: 'HR', lowerBpm: lower.lowerBpm, upperBpm: upper.upperBpm } : null;
}

function withTargets(blocks: RunBlock[], ctx: TargetContext): RunBlock[] {
    return blocks.map((b) => {
        if (isRepeat(b)) return { ...b, steps: withTargets(b.steps, ctx) as typeof b.steps };
        const target = targetFor(b.label, ctx);
        return target ? { ...b, target } : b;
    });
}

export function attachTargets(sessions: TypedSession[], ctx: TargetContext): TypedSession[] {
    return sessions.map((s) =>
        s.kind === 'RUNNING' ? { ...s, body: { ...s.body, steps: withTargets(s.body.steps, ctx) } } : s,
    );
}
