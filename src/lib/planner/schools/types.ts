// Declared training-school data. Client-importable: the setup wizard reads it to draw class cards.
// Every number or flag is wrapped in `Marked` so later research can replace judged values
// without guessing which ones a coach actually stated (#374, #377, #380).

export type Mark = 'sourced' | 'judged';

export interface Marked<T> {
    value: T;
    mark: Mark;
    /** Where a sourced value comes from, or why a judged value was chosen. */
    note?: string;
}

export const sourced = <T>(value: T, note?: string): Marked<T> => ({ value, mark: 'sourced', note });
export const judged = <T>(value: T, note?: string): Marked<T> => ({ value, mark: 'judged', note });

export type SchoolId = 'POLARIZED' | 'DANIELS' | 'PFITZINGER';
export type VolumeUnit = 'MINUTES' | 'METRES';
export type TargetType = 'PACE' | 'HR';

/** GymCraft's cross-cutting strength rule reads this, never the school's identity. */
export type StrengthKind = 'base' | 'build' | 'sharpen';

export interface PhaseDefinition {
    key: string;
    name: string;
    intent: string;
    /** What the athlete loses when this phase is shortened or dropped. */
    lossLine: string;
    idealWeeks: Marked<number>;
    floorWeeks: Marked<number>;
    droppable: Marked<boolean>;
    /**
     * Never offered as a compression choice. Present only when the athlete has no lead-in and
     * runs less than this per week; otherwise the phase counts as already done.
     */
    autoSatisfiedAboveRecentMetres?: Marked<number>;
    volumeUnit: VolumeUnit;
    strengthKind: StrengthKind;
}

export interface IntensityLabel {
    key: string;
    name: string;
    /** Edwards zone weight (1–5), used for costing only. */
    edwardsWeight: Marked<number>;
    targetType: Marked<TargetType>;
    /** For pace labels: how the pace derives from the anchor. */
    paceDerivation?: string;
}

export type PeakRule =
    | { kind: 'clamp'; multipleOfRecent: Marked<number>; min: Marked<number>; max: Marked<number> }
    | { kind: 'tiers'; tiers: Marked<number[]> };

export type RampRule =
    | { kind: 'linear'; startFractionOfPeak: Marked<number>; maxStepFraction: Marked<number> }
    | { kind: 'step-hold'; stepPerRunPerWeek: Marked<number>; holdWeeks: Marked<number> };

export interface SchoolDefinition {
    id: SchoolId;
    name: string;
    lore: string;
    /** One line on the class card. */
    tagline: string;
    /** Chronological order. */
    phases: PhaseDefinition[];
    /** Phase keys, first to give up weeks first when the horizon is short. */
    compressionOrder: Marked<string[]>;
    /** Droppable phase keys, first to drop first. */
    dropOrder: Marked<string[]>;
    schoolFloorWeeks: Marked<number>;
    peak: PeakRule;
    ramp: RampRule;
    /** Loading weeks between cutbacks; `null` when the school places none. */
    cutbackCadence: Marked<number | null>;
    cutbackDepth: Marked<number>;
    /** Fractions of peak for the final weeks of the horizon, in calendar order. */
    taperFractions: Marked<number[]>;
    leadIn: { split: Marked<string>; touch: Marked<'strides' | 'hills'> };
    intensityLabels: IntensityLabel[];
    keySessions: { key: string; name: string; reason: string }[];
    /** Non-key sessions, cheapest to lose first. */
    cutOrder: Marked<string[]>;
    strengthTemplates: { key: string; name: string; tag: 'heavy' | 'light' }[];
}
