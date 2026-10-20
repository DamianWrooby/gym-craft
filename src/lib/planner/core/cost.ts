// Cost (ADR 0009): planned load of one session, in TRIMP, with the method that produced it.
// Running is costed from the school's label table; strength and other at flat rates.
import { judged, type SchoolDefinition } from '../schools/types';
import { isRepeat, type OtherEffort, type PlannedLoadMethod, type RunBlock, type TypedSession } from './session';

/** Strength has no intensity label and its heart rate does not measure its cost. */
export const STRENGTH_TRIMP_PER_MIN = judged(2, 'The flat fallback rate (story 92).');

export const OTHER_TRIMP_PER_MIN: Record<OtherEffort, number> = { easy: 2, moderate: 3, hard: 4 };

export interface CostContext {
    school: SchoolDefinition;
    /** Pace per intensity label from the anchor; null when no anchor exists. */
    paceSecPerKm: Record<string, number> | null;
}

export interface Cost {
    plannedLoad: number;
    method: PlannedLoadMethod;
}

/** Minutes a step is meant to last. Distance converts through the anchor pace (ADR 0009). */
export function stepMinutes(step: { label: string; durationSec?: number; distanceM?: number }, ctx: CostContext) {
    if (step.durationSec != null) return step.durationSec / 60;
    const pace = ctx.paceSecPerKm?.[step.label];
    if (pace == null || step.distanceM == null) throw new Error(`No pace for label ${step.label}`);
    return ((step.distanceM / 1000) * pace) / 60;
}

function blocksLoad(blocks: RunBlock[], ctx: CostContext): number {
    return blocks.reduce((sum, block) => {
        if (isRepeat(block)) return sum + block.repeat * blocksLoad(block.steps, ctx);
        const label = ctx.school.intensityLabels.find((l) => l.key === block.label);
        if (!label) throw new Error(`Unknown label ${block.label}`);
        return sum + stepMinutes(block, ctx) * label.edwardsWeight.value;
    }, 0);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function costSession(session: TypedSession, ctx: CostContext): Cost {
    switch (session.kind) {
        case 'RUNNING':
            return { plannedLoad: round1(blocksLoad(session.body.steps, ctx)), method: 'LABEL_TABLE' };
        case 'STRENGTH':
            return { plannedLoad: session.body.durationMin * STRENGTH_TRIMP_PER_MIN.value, method: 'DURATION' };
        case 'OTHER':
            return {
                plannedLoad: session.body.durationMin * OTHER_TRIMP_PER_MIN[session.body.effort],
                method: 'ATHLETE_ESTIMATE',
            };
    }
}
