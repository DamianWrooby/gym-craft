// Layout (ADRs 0008, 0012, 0020, 0021, 0025): lays the whole horizon out as phases and plan weeks.
// Pure arithmetic over the school's declared data. No AI call, no I/O.
import { m } from '$lib/paraglide/messages.js';
import { displaySchool } from '$lib/i18n/school-text';
import { addDays, daysBetween, mondayOf } from '$lib/utils/iso-week';
import type { PhaseDefinition, SchoolDefinition, SchoolId, VolumeUnit } from '../schools/types';
import {
    CUTBACK_CAP,
    LEAD_IN,
    NO_HISTORY_START_FRACTION,
    ROUNDING,
    STRENGTH,
    TIME_TRIAL,
} from '../schools/gymcraft-rules';

/** Weeks per school phase key; 0 drops a droppable phase. */
export type Compression = Record<string, number>;

export interface RecentVolume {
    /** Mean weekly running time over the last 28 days. */
    minutesPerWeek: number;
    /** Mean weekly running distance over the last 28 days. */
    metresPerWeek: number;
}

export interface LayoutInput {
    school: SchoolDefinition;
    /** The day the athlete sets the plan up (YYYY-MM-DD). */
    startDate: string;
    /** Race day, or the end the athlete chose. */
    endDate: string;
    goal: { isRace: boolean; distanceM: number | null };
    compression?: Compression;
    recentVolume: RecentVolume;
    /** Training days in the availability map. */
    runsPerWeek: number;
    anchorPresent: boolean;
    /** A re-lay that carries on from training already in the plan (ADR 0019). */
    resume?: Resume;
}

/** Where a re-lay picks up: no lead-in, and the ramp and the cutback count carry on. */
export interface Resume {
    /** The school phase underway; the phases before it are done. Absent: the school starts at its first phase. */
    phaseKey?: string;
    /** Weeks of that phase already in the plan. */
    weeksDone: number;
    /** The last loading week's volume, in the school's unit; null when it was in another unit. */
    volume: number | null;
    /** Loading weeks since the last cutback or taper week. */
    loadingRun: number;
}

export type LeadInKind = 'none' | 'bridge' | 'lead-in';

export interface LaidPhase {
    key: string;
    ordinal: number;
    name: string;
    intent: string;
    source: 'SCHOOL' | 'LEAD_IN';
    school: SchoolId;
    volumeUnit: VolumeUnit;
    startDate: string;
    endDate: string;
    weekCount: number;
}

export interface LaidWeek {
    index: number;
    phaseOrdinal: number;
    startDate: string; // Monday
    endDate: string; // Sunday
    inHorizonDays: number;
    isCutback: boolean;
    /** A taper week counts as recovery for the cutback cap but is not a cutback week. */
    isTaper: boolean;
    volumeTarget: number;
    volumeUnit: VolumeUnit;
    strengthSessionTarget: number;
}

export interface Layout {
    phases: LaidPhase[];
    weeks: LaidWeek[];
    leadIn: LeadInKind;
    /** Present only when no anchor exists (ADR 0020). */
    timeTrial: { weekIndex: number; distanceM: number } | null;
    /** One line per phase shortened or dropped, naming the specific loss. */
    losses: string[];
}

export type LayoutResult = { ok: true; layout: Layout } | { ok: false; reason: string };

import { LEAD_IN_NAME } from './lead-in-name';
export { LEAD_IN_NAME };

/** Number of Monday–Sunday weeks the horizon touches; partial weeks count as one. */
export function horizonWeekCount(startDate: string, endDate: string): number {
    return daysBetween(mondayOf(startDate), mondayOf(endDate)) / 7 + 1;
}

/** Phases the athlete may compress. Auto-satisfied phases are never a choice. */
export function choosablePhases(school: SchoolDefinition): PhaseDefinition[] {
    return school.phases.filter((p) => !p.autoSatisfiedAboveRecentMetres);
}

/** The compression that keeps the most of the school when `weeks` cannot hold it all. */
export function defaultCompression(school: SchoolDefinition, weeks: number): Compression {
    const phases = choosablePhases(school);
    const result: Compression = Object.fromEntries(phases.map((p) => [p.key, p.idealWeeks.value]));
    const byKey = new Map(phases.map((p) => [p.key, p]));
    let excess = Object.values(result).reduce((a, b) => a + b, 0) - weeks;

    for (const key of school.compressionOrder.value) {
        if (excess <= 0) break;
        const cut = Math.min(excess, result[key] - byKey.get(key)!.floorWeeks.value);
        result[key] -= cut;
        excess -= cut;
    }
    for (const key of school.dropOrder.value) {
        if (excess <= 0) break;
        excess -= result[key];
        result[key] = 0;
    }
    for (const key of [...school.compressionOrder.value].reverse()) {
        if (excess >= 0) break;
        if (result[key] === 0) continue;
        const back = Math.min(-excess, byKey.get(key)!.idealWeeks.value - result[key]);
        result[key] += back;
        excess += back;
    }
    return result;
}

function validateCompression(school: SchoolDefinition, compression: Compression, weeks: number): string | null {
    let total = 0;
    const shown = displaySchool(school);
    for (const p of choosablePhases(shown)) {
        const n = compression[p.key];
        if (n === 0) {
            if (!p.droppable.value) return m.layout_cannot_drop({ phase: p.name });
            continue;
        }
        if (n < p.floorWeeks.value) return m.layout_phase_min({ phase: p.name, weeks: p.floorWeeks.value });
        if (n > p.idealWeeks.value) return m.layout_phase_max({ phase: p.name, weeks: p.idealWeeks.value });
        total += n;
    }
    if (total < school.schoolFloorWeeks.value) {
        return m.layout_school_min({ school: shown.name, weeks: school.schoolFloorWeeks.value });
    }
    if (total > weeks) return m.layout_too_long({ total, weeks });
    return null;
}

export function compressionLosses(school: SchoolDefinition, compression: Compression): string[] {
    const losses: string[] = [];
    for (const p of choosablePhases(displaySchool(school))) {
        const n = compression[p.key];
        if (n === 0) losses.push(m.layout_loss_dropped({ phase: p.name, loss: p.lossLine }));
        else if (n < p.idealWeeks.value) {
            losses.push(m.layout_loss_shortened({ phase: p.name, from: p.idealWeeks.value, to: n, loss: p.lossLine }));
        }
    }
    return losses;
}

function roundVolume(value: number, unit: VolumeUnit): number {
    const step = ROUNDING[unit].value;
    return Math.max(0, Math.round(value / step) * step);
}

function peakFor(school: SchoolDefinition, recent: number): number {
    const peak = school.peak;
    if (peak.kind === 'clamp') {
        return Math.min(peak.max.value, Math.max(peak.min.value, peak.multipleOfRecent.value * recent));
    }
    const tiers = [...peak.tiers.value].sort((a, b) => a - b);
    return tiers.find((t) => t >= recent) ?? tiers[tiers.length - 1];
}

function schoolStart(school: SchoolDefinition, recent: number, peak: number): number {
    if (school.ramp.kind === 'linear') {
        return Math.min(peak, Math.max(recent, school.ramp.startFractionOfPeak.value * peak));
    }
    return recent > 0 ? Math.min(recent, peak) : NO_HISTORY_START_FRACTION.value * peak;
}

interface PhaseSlot {
    def: PhaseDefinition | null; // null = lead-in
    weeks: number;
}

/**
 * The school as a resume sees it: the phases before the one underway are gone, and that phase is
 * shorter by the weeks done. Its floor drops with them, but never below one week.
 */
function remainingSchool(school: SchoolDefinition, resume: Resume): SchoolDefinition {
    const from = resume.phaseKey ? school.phases.findIndex((p) => p.key === resume.phaseKey) : 0;
    if (!resume.phaseKey || from < 0) return school;
    const [underway, ...after] = school.phases.slice(from);
    const ideal = underway.idealWeeks.value - resume.weeksDone;
    const current: PhaseDefinition[] =
        ideal <= 0
            ? []
            : [
                  {
                      ...underway,
                      autoSatisfiedAboveRecentMetres: undefined,
                      idealWeeks: { ...underway.idealWeeks, value: ideal },
                      floorWeeks: {
                          ...underway.floorWeeks,
                          value: Math.min(ideal, Math.max(1, underway.floorWeeks.value - resume.weeksDone)),
                      },
                  },
              ];
    const phases = [...current, ...after];
    const keys = new Set(phases.map((p) => p.key));
    const floors = phases.filter((p) => !p.autoSatisfiedAboveRecentMetres).reduce((a, p) => a + p.floorWeeks.value, 0);
    return {
        ...school,
        phases,
        compressionOrder: {
            ...school.compressionOrder,
            value: school.compressionOrder.value.filter((k) => keys.has(k)),
        },
        dropOrder: { ...school.dropOrder, value: school.dropOrder.value.filter((k) => keys.has(k)) },
        schoolFloorWeeks: { ...school.schoolFloorWeeks, value: Math.min(school.schoolFloorWeeks.value, floors) },
    };
}

export function layoutHorizon(input: LayoutInput): LayoutResult {
    const { resume } = input;
    const school = resume ? remainingSchool(input.school, resume) : input.school;
    const { startDate, endDate, goal, recentVolume, runsPerWeek, anchorPresent } = input;
    if (endDate <= startDate) return { ok: false, reason: m.layout_end_before_start() };

    const n = horizonWeekCount(startDate, endDate);
    if (n < school.schoolFloorWeeks.value) {
        return {
            ok: false,
            reason: `${school.name} needs at least ${school.schoolFloorWeeks.value} weeks; this horizon has ${n}.`,
        };
    }

    const compression = { ...defaultCompression(school, n), ...(input.compression ?? {}) };
    const invalid = validateCompression(school, compression, n);
    if (invalid) return { ok: false, reason: invalid };

    // Phases before the lead-in decision: auto-satisfied phases fill lead-in room only when the
    // athlete is not running and the room fits the phase; otherwise the lead-in covers it.
    const slots: PhaseSlot[] = [];
    let room = n - Object.values(compression).reduce((a, b) => a + b, 0);
    for (const p of school.phases) {
        const threshold = p.autoSatisfiedAboveRecentMetres;
        if (threshold) {
            const fits = room >= p.floorWeeks.value && room <= p.idealWeeks.value;
            if (recentVolume.metresPerWeek < threshold.value && fits) {
                slots.push({ def: p, weeks: room });
                room = 0;
            }
            continue;
        }
        if (compression[p.key] > 0) slots.push({ def: p, weeks: compression[p.key] });
    }
    // A resume has no lead-in: the athlete is past it. Spare weeks lengthen the phase underway.
    if (resume && room > 0 && slots.length > 0) {
        slots[0].weeks += room;
        room = 0;
    }
    const leadInKind: LeadInKind = room === 0 ? 'none' : room < LEAD_IN.bridgeBelowWeeks.value ? 'bridge' : 'lead-in';
    if (room > 0) slots.unshift({ def: null, weeks: room });

    // Weeks on the Monday–Sunday grid.
    const firstMonday = mondayOf(startDate);
    const grid = Array.from({ length: n }, (_, i) => {
        const monday = addDays(firstMonday, i * 7);
        const sunday = addDays(monday, 6);
        const from = monday < startDate ? startDate : monday;
        const to = sunday > endDate ? endDate : sunday;
        return { monday, sunday, from, to, inHorizonDays: daysBetween(from, to) + 1 };
    });

    const phases: LaidPhase[] = [];
    const weekPhase: PhaseSlot[] = [];
    let cursor = 0;
    slots.forEach((slot, ordinal) => {
        const first = grid[cursor];
        const last = grid[cursor + slot.weeks - 1];
        const def = slot.def;
        phases.push({
            key: def?.key ?? 'lead-in',
            ordinal,
            name: def?.name ?? LEAD_IN_NAME,
            intent: def?.intent ?? leadInIntent(school, leadInKind),
            source: def ? 'SCHOOL' : 'LEAD_IN',
            school: school.id,
            volumeUnit: def?.volumeUnit ?? 'MINUTES',
            startDate: first.from,
            endDate: last.to,
            weekCount: slot.weeks,
        });
        for (let i = 0; i < slot.weeks; i++) weekPhase.push(slot);
        cursor += slot.weeks;
    });

    // Pass 1: taper and cutback flags. One counter across the whole horizon (ADR 0021).
    const taperFractions = school.taperFractions.value;
    const taperFrom = n - taperFractions.length;
    const cadence = school.cutbackCadence;
    const schoolLimit =
        cadence.mark === 'sourced' && cadence.value != null
            ? cadence.value
            : Math.min(cadence.value ?? CUTBACK_CAP.value, CUTBACK_CAP.value);
    const flags: { isTaper: boolean; isCutback: boolean }[] = [];
    let run = resume?.loadingRun ?? 0;
    for (let i = 0; i < n; i++) {
        const slot = weekPhase[i];
        if (i >= taperFrom) {
            flags.push({ isTaper: true, isCutback: false });
            run = 0;
        } else if (!slot.def && leadInKind === 'bridge') {
            flags.push({ isTaper: false, isCutback: false });
        } else {
            const limit = slot.def ? schoolLimit : CUTBACK_CAP.value;
            const isCutback = run >= limit;
            flags.push({ isTaper: false, isCutback });
            run = isCutback ? 0 : run + 1;
        }
    }

    // Pass 2: volume targets.
    const schoolUnit = school.phases[0].volumeUnit;
    const recentInSchoolUnit = schoolUnit === 'MINUTES' ? recentVolume.minutesPerWeek : recentVolume.metresPerWeek;
    const peak = peakFor(school, recentInSchoolUnit);
    const start =
        resume?.volume != null ? Math.min(peak, resume.volume) : schoolStart(school, recentInSchoolUnit, peak);
    const handOffMinutes =
        schoolUnit === 'MINUTES'
            ? start
            : recentVolume.metresPerWeek > 0 && recentVolume.minutesPerWeek > 0
              ? (start * recentVolume.minutesPerWeek) / recentVolume.metresPerWeek
              : (start / 1000) * (LEAD_IN.easyPaceSecPerKmWithoutHistory.value / 60);
    const leadInStart =
        recentVolume.minutesPerWeek > 0 ? recentVolume.minutesPerWeek : LEAD_IN.startMinutesWithoutHistory.value;

    const schoolLoadingCount = flags.filter((f, i) => weekPhase[i].def && !f.isTaper && !f.isCutback).length;
    let leadInK = 0;
    let leadInLast = leadInStart;
    let schoolK = 0;
    let schoolLast = start;

    const raw: number[] = flags.map((f, i) => {
        const def = weekPhase[i].def;
        if (!def) {
            if (leadInKind === 'bridge') return leadInStart;
            if (f.isCutback) return leadInLast * (1 - LEAD_IN.cutbackDepth.value);
            leadInLast = Math.min(leadInStart * Math.pow(1 + LEAD_IN.weeklyIncrease.value, leadInK++), handOffMinutes);
            return leadInLast;
        }
        if (f.isTaper) return peak * taperFractions[i - taperFrom];
        if (f.isCutback) return schoolLast * (1 - school.cutbackDepth.value);
        const k = schoolK++;
        if (school.ramp.kind === 'linear') {
            const linear = schoolLoadingCount > 1 ? start + ((peak - start) * k) / (schoolLoadingCount - 1) : start;
            schoolLast = k === 0 ? start : Math.min(linear, schoolLast * (1 + school.ramp.maxStepFraction.value));
        } else {
            const steps = Math.floor(k / school.ramp.holdWeeks.value);
            schoolLast = Math.min(peak, start + steps * school.ramp.stepPerRunPerWeek.value * runsPerWeek);
        }
        return schoolLast;
    });

    const weeks: LaidWeek[] = grid.map((g, i) => {
        const slot = weekPhase[i];
        const unit: VolumeUnit = slot.def?.volumeUnit ?? 'MINUTES';
        const { isTaper, isCutback } = flags[i];
        let strength = slot.def ? STRENGTH[slot.def.strengthKind].value : STRENGTH.leadIn.value;
        if (isCutback) strength = Math.max(STRENGTH.cutbackFloor.value, strength - STRENGTH.cutbackReduction.value);
        if (isTaper) strength = Math.min(strength, STRENGTH.taperMax.value);
        if (i === n - 1 && goal.isRace) strength = STRENGTH.raceWeek.value;
        return {
            index: i,
            phaseOrdinal: slots.indexOf(slot),
            startDate: g.monday,
            endDate: g.sunday,
            inHorizonDays: g.inHorizonDays,
            isCutback,
            isTaper,
            volumeTarget: roundVolume((raw[i] * g.inHorizonDays) / 7, unit),
            volumeUnit: unit,
            strengthSessionTarget: strength,
        };
    });

    const timeTrial = anchorPresent
        ? null
        : {
              weekIndex: leadInKind === 'none' ? 0 : room - 1,
              distanceM:
                  goal.distanceM != null && goal.distanceM > TIME_TRIAL.shortGoalMaxM.value
                      ? TIME_TRIAL.longDistanceM.value
                      : TIME_TRIAL.shortDistanceM.value,
          };

    return {
        ok: true,
        layout: { phases, weeks, leadIn: leadInKind, timeTrial, losses: compressionLosses(school, compression) },
    };
}

function leadInIntent(school: SchoolDefinition, kind: LeadInKind): string {
    return kind === 'bridge'
        ? m.layout_lead_in_bridge({ school: displaySchool(school).name })
        : m.layout_lead_in_base({ school: displaySchool(school).name });
}
