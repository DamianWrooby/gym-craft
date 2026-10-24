// Race-first goal form rules (#421): the athlete types km and `h:mm:ss`, picks A/B/C; the API keeps
// metres, seconds and a priority number. Pure, client-importable.

import type { GoalType } from '@prisma/client';

const DURATION = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/;

/** `h:mm:ss` or `mm:ss` as seconds; null when the text is not a positive time. */
export function parseDuration(text: string): number | null {
    const match = DURATION.exec(text.trim());
    if (!match) return null;
    const [, h, m, s] = match;
    if (h != null && m.length !== 2) return null;
    const sec = Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s);
    return sec > 0 ? sec : null;
}

export function formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export type RaceClass = 'A' | 'B' | 'C';

/** Another goal of the athlete's, as far as class and order need it. */
export interface GoalRank {
    goalType: GoalType;
    priority: number;
}

const PRIORITY: Record<RaceClass, number> = { A: 1, B: 2, C: 3 };

/** A stored priority of 3 or more shows as C. */
export const classOf = (priority: number): RaceClass => (priority <= 1 ? 'A' : priority === 2 ? 'B' : 'C');

export const priorityOf = (raceClass: RaceClass): number => PRIORITY[raceClass];

export const defaultClass = (others: GoalRank[]): RaceClass =>
    others.some((g) => g.goalType === 'RACE' && g.priority <= 1) ? 'B' : 'A';

export type DistanceKey = '5k' | '10k' | 'half' | 'marathon' | 'custom';
export type Focus = Exclude<GoalType, 'RACE'>;

export const DISTANCES: { key: Exclude<DistanceKey, 'custom'>; label: string; metres: number }[] = [
    { key: '5k', label: '5 km', metres: 5000 },
    { key: '10k', label: '10 km', metres: 10000 },
    { key: 'half', label: 'Half marathon', metres: 21097 },
    { key: 'marathon', label: 'Marathon', metres: 42195 },
];

/** What the form holds: text as the athlete typed it, plus the stored priority to keep. */
export interface GoalFormState {
    isRace: boolean;
    distance: DistanceKey;
    customKm: string;
    date: string;
    name: string;
    raceClass: RaceClass;
    time: string;
    focus: Focus;
    notes: string;
    /** The saved goal's priority; null for a new goal. */
    storedPriority: number | null;
}

/** A saved goal, dates as YYYY-MM-DD. */
export interface StoredGoal {
    goalType: GoalType;
    targetEventName: string | null;
    targetEventDate: string | null;
    targetDistanceM: number | null;
    targetTimeSec: number | null;
    priority: number;
    notes: string | null;
}

/** The running-goals API body. */
export type GoalInput = StoredGoal;

export function fromGoal(goal: StoredGoal | null, others: GoalRank[]): GoalFormState {
    const known = DISTANCES.find((d) => d.metres === goal?.targetDistanceM);
    const metres = goal?.targetDistanceM;
    return {
        isRace: goal == null || goal.goalType === 'RACE',
        distance: known?.key ?? (metres != null ? 'custom' : 'half'),
        customKm: !known && metres != null ? String(metres / 1000) : '',
        date: goal?.targetEventDate ?? '',
        name: goal?.targetEventName ?? '',
        raceClass: goal ? classOf(goal.priority) : defaultClass(others),
        time: goal?.targetTimeSec ? formatDuration(goal.targetTimeSec) : '',
        focus: goal && goal.goalType !== 'RACE' ? goal.goalType : 'BASE_BUILDING',
        notes: goal?.notes ?? '',
        storedPriority: goal?.priority ?? null,
    };
}

function distanceMetres(form: GoalFormState): number | null {
    if (form.distance !== 'custom') return DISTANCES.find((d) => d.key === form.distance)!.metres;
    const km = Number(form.customKm);
    return form.customKm.trim() && Number.isFinite(km) ? Math.round(km * 1000) : null;
}

export function toGoalInput(form: GoalFormState, others: GoalRank[]): GoalInput {
    const notes = form.notes.trim() || null;
    if (!form.isRace) {
        return {
            goalType: form.focus,
            targetEventName: null,
            targetEventDate: null,
            targetDistanceM: null,
            targetTimeSec: null,
            priority: form.storedPriority ?? Math.max(0, ...others.map((g) => g.priority)) + 1,
            notes,
        };
    }
    const keep = form.storedPriority != null && classOf(form.storedPriority) === form.raceClass;
    return {
        goalType: 'RACE',
        targetEventName: form.name.trim() || null,
        targetEventDate: form.date || null,
        targetDistanceM: distanceMetres(form),
        targetTimeSec: form.time.trim() ? parseDuration(form.time) : null,
        priority: keep ? form.storedPriority! : priorityOf(form.raceClass),
        notes,
    };
}

export const CUSTOM_KM = { min: 1.5, max: 42.2 };
export const NOTES_MAX = 500;

/** The one reason save is blocked, or null. `today` is the athlete's local YYYY-MM-DD. */
export function goalFormIssue(form: GoalFormState, today: string): string | null {
    if (form.notes.length > NOTES_MAX) return `Notes must be at most ${NOTES_MAX} characters.`;
    if (!form.isRace) return null;
    if (!form.date) return 'Choose the race date.';
    if (form.date <= today) return 'The race date must be after today.';
    if (form.distance === 'custom') {
        const metres = distanceMetres(form);
        if (metres == null || metres < CUSTOM_KM.min * 1000 || metres > CUSTOM_KM.max * 1000) {
            return `The distance must be ${CUSTOM_KM.min}–${CUSTOM_KM.max} km.`;
        }
    }
    if (form.time.trim() && parseDuration(form.time) == null) {
        return 'Type the target time as h:mm:ss or mm:ss, for example 1:45:00.';
    }
    return null;
}
