// Recut (ADRs 0015, 0019; stories 80–85): a change to the horizon's structure — goal date or school —
// re-lays only the weeks not yet pulled, from the week after the last written one. A race moved up
// to 7 days earlier is absorbed silently when no floor breaks; anything else is a full re-lay the
// athlete confirms. Pure.
import { addDays, daysBetween, mondayOf } from '$lib/utils/iso-week';
import { getSchool } from '../schools/catalogue';
import type { SchoolId } from '../schools/types';
import {
    horizonWeekCount,
    layoutHorizon,
    type LaidPhase,
    type LaidWeek,
    type LayoutInput,
    type Resume,
} from './layout';

/** A stored phase, as the recut reads it. */
export type StoredPhase = Omit<LaidPhase, 'weekCount'>;

/** A stored plan week, as the recut reads it. */
export interface StoredWeek extends Omit<LaidWeek, 'index'> {
    generation: 'PENDING' | 'GENERATED' | 'FAILED';
    /** An AI request exists for the week: it was pulled, so it is no longer the recut's to move. */
    pulled: boolean;
    timeTrialDistanceM: number | null;
}

export interface RecutInput extends Pick<LayoutInput, 'goal' | 'recentVolume' | 'runsPerWeek' | 'anchorPresent'> {
    today: string;
    /** The plan's current end date. */
    endDate: string;
    phases: StoredPhase[];
    /** Every plan week, in date order. */
    weeks: StoredWeek[];
    change: { endDate?: string; schoolId?: SchoolId };
}

export interface RecutPlan {
    /** Monday of the first re-laid week; every week before it stays as stored. */
    relayFrom: string;
    endDate: string;
    schoolId: SchoolId;
    /** The new tail. Ordinals and `phaseOrdinal` count from 0 within it. */
    phases: LaidPhase[];
    weeks: LaidWeek[];
    timeTrial: { weekIndex: number; distanceM: number } | null;
    losses: string[];
    /** The cost, in the athlete's words: "Weeks 9–16 will be re-laid under Daniels." */
    summary: string;
}

export type RecutResult =
    | { kind: 'refused'; reason: string }
    /** Applied without asking (story 84). */
    | ({ kind: 'absorbed' } & RecutPlan)
    /** Shown to the athlete, applied only on confirm (story 82). */
    | ({ kind: 'relaid' } & RecutPlan);

/** Judged (story 84): a race a few days earlier is a small change, a fortnight is a new plan. */
const ABSORB_MAX_DAYS = 7;

export function recut(input: RecutInput): RecutResult {
    const { today, weeks, phases } = input;
    const currentSchool = phases[phases.length - 1].school;
    const schoolId = input.change.schoolId ?? currentSchool;
    const endDate = input.change.endDate ?? input.endDate;
    if (schoolId === currentSchool && endDate === input.endDate)
        return { kind: 'refused', reason: 'Nothing to change.' };
    if (endDate <= today) return { kind: 'refused', reason: 'The goal date must be after today.' };

    // Kept: the current week, and everything up to the last week that was pulled or written.
    const thisMonday = mondayOf(today);
    const keptCount =
        weeks.reduce(
            (last, w, i) => (w.startDate <= thisMonday || w.pulled || w.generation !== 'PENDING' ? i : last),
            -1,
        ) + 1;
    if (keptCount === 0) return { kind: 'refused', reason: 'The plan has not started yet; set it up again.' };
    const lastKept = weeks[keptCount - 1];
    const relayFrom = addDays(lastKept.endDate, 1);
    if (endDate <= lastKept.endDate) {
        return {
            kind: 'refused',
            reason: `Weeks up to ${lastKept.endDate} are already written; the goal date must be after them.`,
        };
    }

    const days = daysBetween(endDate, input.endDate);
    if (schoolId === currentSchool && days > 0 && days <= ABSORB_MAX_DAYS) {
        const absorbed = absorb(input, keptCount, relayFrom, endDate, currentSchool);
        if (absorbed) return { kind: 'absorbed', ...absorbed };
    }

    const school = getSchool(schoolId);
    const result = layoutHorizon({
        school,
        startDate: relayFrom,
        endDate,
        goal: input.goal,
        recentVolume: input.recentVolume,
        runsPerWeek: input.runsPerWeek,
        anchorPresent: input.anchorPresent,
        resume: resumeFrom(input, keptCount, schoolId),
    });
    if (!result.ok) return { kind: 'refused', reason: result.reason };
    const { phases: laid, weeks: laidWeeks, timeTrial, losses } = result.layout;
    return {
        kind: 'relaid',
        relayFrom,
        endDate,
        schoolId,
        phases: laid,
        weeks: laidWeeks,
        timeTrial,
        losses,
        summary: `Weeks ${keptCount + 1}–${keptCount + laidWeeks.length} will be re-laid under ${school.name}.`,
    };
}

/**
 * Where the re-lay picks up (ADR 0019): inside the school phase underway when the school stays, at
 * the new school's first phase otherwise. A lead-in still underway is no resume: the re-lay sizes it.
 */
function resumeFrom(input: RecutInput, keptCount: number, schoolId: SchoolId): Resume | undefined {
    const kept = input.weeks.slice(0, keptCount);
    const last = kept[kept.length - 1];
    const phase = input.phases.find((p) => p.ordinal === last.phaseOrdinal);
    if (!phase || phase.source !== 'SCHOOL') return undefined;
    const same = phase.school === schoolId;
    const unit = getSchool(schoolId).phases[0].volumeUnit;
    const backwards = [...kept].reverse();
    const recovery = backwards.findIndex((w) => w.isCutback || w.isTaper);
    const loading = backwards.find((w) => !w.isCutback && !w.isTaper);
    return {
        phaseKey: same ? phase.key : undefined,
        weeksDone: same ? kept.filter((w) => w.phaseOrdinal === last.phaseOrdinal).length : 0,
        volume: loading && loading.volumeUnit === unit ? loading.volumeTarget : null,
        loadingRun: recovery < 0 ? kept.length : recovery,
    };
}

/**
 * The tail with one week fewer, or the same weeks with a shorter last one. The week comes from the
 * lead-in first, then the school's compression order; never a phase underway, never the taper,
 * never a cutback or time-trial week, never below a floor. When the school's cutback cadence is
 * sourced, never a week before a cutback: the cutback would move one week earlier. Null when no week may go.
 */
function absorb(
    input: RecutInput,
    keptCount: number,
    relayFrom: string,
    endDate: string,
    schoolId: SchoolId,
): RecutPlan | null {
    const tail = input.weeks.slice(keptCount);
    const underway = new Set(input.weeks.slice(0, keptCount).map((w) => w.phaseOrdinal));
    const surplus = tail.length - horizonWeekCount(relayFrom, endDate);

    let kept = tail;
    let removedFrom: StoredPhase | null = null;
    if (surplus === 1) {
        const index = removableWeek(input.phases, tail, underway);
        if (index == null) return null;
        removedFrom = input.phases.find((p) => p.ordinal === tail[index].phaseOrdinal)!;
        kept = tail.filter((_, i) => i !== index);
    } else if (surplus !== 0) return null;

    // Re-date from relayFrom; the last week ends on the new goal date with its volume pro rata.
    const ordinals = [...new Set(kept.map((w) => w.phaseOrdinal))];
    const weeks: LaidWeek[] = kept.map((w, i) => {
        const startDate = addDays(relayFrom, 7 * i);
        const last = i === kept.length - 1;
        const inHorizonDays = last ? daysBetween(startDate, endDate) + 1 : 7;
        return {
            isCutback: w.isCutback,
            isTaper: w.isTaper,
            volumeUnit: w.volumeUnit,
            strengthSessionTarget: w.strengthSessionTarget,
            index: i,
            phaseOrdinal: ordinals.indexOf(w.phaseOrdinal),
            startDate,
            endDate: addDays(startDate, 6),
            inHorizonDays,
            volumeTarget:
                inHorizonDays === w.inHorizonDays
                    ? w.volumeTarget
                    : Math.round((w.volumeTarget * inHorizonDays) / w.inHorizonDays),
        };
    });
    const phases: LaidPhase[] = ordinals.map((stored, ordinal) => {
        const p = input.phases.find((x) => x.ordinal === stored)!;
        const own = weeks.filter((w) => w.phaseOrdinal === ordinal);
        const last = own[own.length - 1];
        return {
            ...p,
            ordinal,
            startDate: own[0].startDate,
            endDate: last.index === weeks.length - 1 ? endDate : last.endDate,
            weekCount: own.length,
        };
    });
    const trial = kept.findIndex((w) => w.timeTrialDistanceM != null);

    return {
        relayFrom,
        endDate,
        schoolId,
        phases,
        weeks,
        timeTrial: trial < 0 ? null : { weekIndex: trial, distanceM: kept[trial].timeTrialDistanceM! },
        losses: [],
        summary: removedFrom
            ? `Goal date moved to ${endDate}: ${removedFrom.name} is one week shorter.`
            : `Goal date moved to ${endDate}: the last week is shorter.`,
    };
}

function removableWeek(phases: StoredPhase[], tail: StoredWeek[], underway: Set<number>): number | null {
    const weeksOf = (ordinal: number) => tail.filter((w) => w.phaseOrdinal === ordinal).length;
    const candidates = phases.filter((p) => {
        if (underway.has(p.ordinal) || weeksOf(p.ordinal) === 0) return false;
        if (p.source === 'LEAD_IN') return true;
        const def = getSchool(p.school).phases.find((d) => d.key === p.key);
        return def != null && weeksOf(p.ordinal) - 1 >= def.floorWeeks.value;
    });
    const rank = (p: StoredPhase) => {
        if (p.source === 'LEAD_IN') return -1;
        const order = getSchool(p.school).compressionOrder.value.indexOf(p.key);
        return order < 0 ? Infinity : order;
    };
    for (const phase of [...candidates].sort((a, b) => rank(a) - rank(b))) {
        if (rank(phase) === Infinity) continue;
        const cadence = getSchool(phase.school).cutbackCadence;
        const exactCadence = cadence.mark === 'sourced' && cadence.value != null;
        const index = tail.findIndex(
            (w, i) =>
                w.phaseOrdinal === phase.ordinal &&
                !w.isTaper &&
                !w.isCutback &&
                w.timeTrialDistanceM == null &&
                !(exactCadence && tail.slice(i + 1).some((later) => later.isCutback)),
        );
        if (index >= 0) return index;
    }
    return null;
}
