// GymCraft's own planning rules: the lead-in, the cutback cap and the strength cadence.
// No coach supplies these, so every value is judged (ADRs 0020, 0021; #380 §5–6).
import { judged } from './types';

export const LEAD_IN = {
    /** Below this many weeks the lead-in is a bridge: no ramp, no cutback. */
    bridgeBelowWeeks: judged(3, 'ADR 0020.'),
    startMinutesWithoutHistory: judged(90, 'Minutes per week when the athlete has no recent running.'),
    weeklyIncrease: judged(0.1, 'The ≤ 10 %/week convention; no primary source endorses it.'),
    cutbackDepth: judged(0.2),
    /** Converts a distance school's start volume to lead-in minutes when the athlete has no pace history. */
    easyPaceSecPerKmWithoutHistory: judged(390, 'A conservative 6:30/km easy pace.'),
};

/** At most this many consecutive loading weeks where the school places no sourced cadence (ADRs 0021, 0025). */
export const CUTBACK_CAP = judged(3, 'ADR 0021.');

export const STRENGTH = {
    base: judged(2, '2–3/week converges (Blagrove 2018); 2 chosen.'),
    build: judged(2),
    sharpen: judged(1, 'Base 2× → race 1× maintenance (Beattie 2017).'),
    leadIn: judged(2),
    taperMax: judged(1),
    raceWeek: judged(0),
    cutbackReduction: judged(1),
    cutbackFloor: judged(1),
};

/** Volume rounding steps per unit (#380). */
export const ROUNDING = {
    MINUTES: judged(5),
    METRES: judged(1000),
};

/** Time-trial distance when no anchor exists (ADR 0020). */
export const TIME_TRIAL = {
    shortGoalMaxM: judged(21097, 'Up to the half marathon.'),
    shortDistanceM: judged(5000),
    longDistanceM: judged(10000),
};

/** Daniels/step-hold start when the athlete has no recent running, as a fraction of peak. */
export const NO_HISTORY_START_FRACTION = judged(0.5);
