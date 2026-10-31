// The typed session body (ADR 0007): a strength session is exercises, a running session is steps.
// Client-importable: the week renderer and the PDF export read these shapes.

export const BODY_VERSION = 1;

export type SessionKind = 'STRENGTH' | 'RUNNING' | 'OTHER';
export type PlannedLoadMethod = 'LABEL_TABLE' | 'DURATION' | 'ATHLETE_ESTIMATE';

/** An athlete-facing target derived from the label, never the other way round (ADR 0009). */
export type StepTarget =
    { type: 'PACE'; minSecPerKm: number; maxSecPerKm: number } | { type: 'HR'; lowerBpm: number; upperBpm: number };

export interface RunStep {
    /** The school's intensity label key. */
    label: string;
    durationSec?: number;
    distanceM?: number;
    note?: string;
    /** Filled by the server at finalize; absent when no anchor or zone can supply it. */
    target?: StepTarget;
}

export interface RunRepeat {
    repeat: number;
    steps: RunStep[];
}

export type RunBlock = RunStep | RunRepeat;

export interface RunningBody {
    bodyVersion: number;
    title: string;
    /** The school's key-session key, or null for a non-key run. */
    keySession: string | null;
    /** The school's reason for a key session, copied from the catalogue. */
    reason: string | null;
    /** The non-key session type, matched against the school's cut order. */
    cutKey: string | null;
    steps: RunBlock[];
}

export interface Exercise {
    name: string;
    sets: number;
    reps: string;
    load: string;
}

export interface StrengthBody {
    bodyVersion: number;
    title: string;
    template: string;
    heavy: boolean;
    durationMin: number;
    exercises: Exercise[];
}

export type OtherEffort = 'easy' | 'moderate' | 'hard';
export const OTHER_EFFORTS: readonly OtherEffort[] = ['easy', 'moderate', 'hard'];

/** Intended training outside the plan's two kinds (story 34). */
export type OtherModality = 'ride' | 'swim' | 'hike' | 'other';
export const OTHER_MODALITIES: readonly OtherModality[] = ['ride', 'swim', 'hike', 'other'];

export interface OtherBody {
    bodyVersion: number;
    title: string;
    /** Absent on bodies written before the athlete could add other training. */
    modality?: OtherModality;
    durationMin: number;
    effort: OtherEffort;
}

export type TypedSession =
    | { kind: 'RUNNING'; scheduledDate: string; sequence: number; body: RunningBody }
    | { kind: 'STRENGTH'; scheduledDate: string; sequence: number; body: StrengthBody }
    | { kind: 'OTHER'; scheduledDate: string; sequence: number; body: OtherBody };

export const isRepeat = (block: RunBlock): block is RunRepeat => 'repeat' in block;
