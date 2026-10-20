// Setup-wizard step gating (ADR 0018). Pure, so the component stays a thin view over it.
import type { HrZoneBound } from './core/zones';
import { isValidZones } from './core/zones';
import type { Compression } from './core/layout';
import type { SchoolId } from './schools/types';

export const WIZARD_STEPS = ['goal', 'school', 'horizon', 'zones', 'results', 'availability'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type AvailabilityMap = Record<Weekday, boolean>;

export interface WizardRaceResult {
    date: string;
    distanceM: number;
    timeSec: number;
    label?: string;
}

export interface WizardState {
    goalId: string | null;
    /** The bound goal's event date; null for an undated goal. */
    goalDate: string | null;
    schoolId: SchoolId | null;
    /** Chosen horizon end for an undated goal. */
    endDate: string | null;
    compression: Compression | null;
    /** True once the horizon cannot be laid out; the athlete must change a choice. */
    layoutRefused: boolean;
    zones: HrZoneBound[] | null;
    zonesConfirmed: boolean;
    raceResults: WizardRaceResult[];
    availability: AvailabilityMap;
    /** 0 = Monday … 6 = Sunday. */
    longRunDay: number | null;
}

export function initialWizardState(zones: HrZoneBound[] | null): WizardState {
    return {
        goalId: null,
        goalDate: null,
        schoolId: null,
        endDate: null,
        compression: null,
        layoutRefused: false,
        zones,
        zonesConfirmed: false,
        raceResults: [],
        availability: { mon: true, tue: false, wed: true, thu: false, fri: true, sat: false, sun: true },
        longRunDay: 6,
    };
}

/** Why the athlete cannot leave this step yet, or null when they can. */
export function stepIssue(step: WizardStep, s: WizardState): string | null {
    switch (step) {
        case 'goal':
            return s.goalId ? null : 'Choose the goal this plan works toward.';
        case 'school':
            return s.schoolId ? null : 'Choose a training school.';
        case 'horizon':
            if (!s.goalDate && !s.endDate) return 'Choose when the horizon ends.';
            return s.layoutRefused ? 'This horizon cannot be laid out. Change the phases or the end date.' : null;
        case 'zones':
            if (!isValidZones(s.zones)) return 'Enter five heart-rate zones, lowest first.';
            return s.zonesConfirmed ? null : 'Confirm your heart-rate zones.';
        case 'results':
            return null; // Optional: no result schedules a time trial.
        case 'availability': {
            if (!WEEKDAYS.some((d) => s.availability[d])) return 'Choose at least one training day.';
            if (s.longRunDay == null) return 'Choose your long-run day.';
            if (!s.availability[WEEKDAYS[s.longRunDay]]) return 'Your long-run day must be a training day.';
            return null;
        }
    }
}

/** The first step with an issue, or null when setup can finish. */
export function firstBlockedStep(s: WizardState): WizardStep | null {
    return WIZARD_STEPS.find((step) => stepIssue(step, s) !== null) ?? null;
}

export function canFinish(s: WizardState): boolean {
    return firstBlockedStep(s) === null;
}

/** Goals the wizard offers: a dated goal must end after today to bound a horizon; undated goals choose a length. */
export function selectableGoals<G extends { date: string | null }>(goals: G[], today: string): G[] {
    return goals.filter((g) => g.date == null || g.date > today);
}
