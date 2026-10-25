import { m } from '$lib/paraglide/messages.js';
// Race-first goal form rules (#421): the athlete types km and `h:mm:ss`, picks A/B/C; the API keeps
// metres, seconds and a priority number. Pure, client-importable.

import type { GoalType } from '@prisma/client';
import { RACE_MAX_M, RACE_MIN_M, distanceName, formatDuration } from '$lib/utils/race';

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

export { formatDuration };

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

const PRESETS: Record<Exclude<DistanceKey, 'custom'>, number> = {
    '5k': 5000,
    '10k': 10000,
    half: 21097,
    marathon: 42195,
};

export const DISTANCES = Object.entries(PRESETS).map(([key, metres]) => {
    return {
        key: key as Exclude<DistanceKey, 'custom'>,
        metres,
        // A getter, so the label follows the locale of the request that renders it.
        get label() {
            const name = distanceName(metres);
            return name[0].toUpperCase() + name.slice(1);
        },
    };
});

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
        // A goal that was not a race has no class yet: it gets the default, like a new one.
        raceClass: goal?.goalType === 'RACE' ? classOf(goal.priority) : defaultClass(others),
        time: goal?.targetTimeSec ? formatDuration(goal.targetTimeSec) : '',
        focus: goal && goal.goalType !== 'RACE' ? goal.goalType : 'BASE_BUILDING',
        notes: goal?.notes ?? '',
        storedPriority: goal?.priority ?? null,
    };
}

function distanceMetres(form: GoalFormState): number | null {
    if (form.distance !== 'custom') return DISTANCES.find((d) => d.key === form.distance)!.metres;
    const km = Number(form.customKm.replace(',', '.'));
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

/** The race bounds in km, as the athlete types them: 1.5–42.2. */
export const CUSTOM_KM = { min: RACE_MIN_M / 1000, max: Math.ceil(RACE_MAX_M / 100) / 10 };
export const NOTES_MAX = 500;

/** The one reason save is blocked, or null. `today` is the athlete's local YYYY-MM-DD. */
export function goalFormIssue(form: GoalFormState, today: string): string | null {
    if (form.notes.length > NOTES_MAX) return m.goal_issue_notes_too_long({ max: NOTES_MAX });
    if (!form.isRace) return null;
    if (!form.date) return m.goal_issue_no_date();
    if (form.date <= today) return m.goal_issue_date_past();
    if (form.distance === 'custom') {
        const metres = distanceMetres(form);
        if (metres == null || metres < CUSTOM_KM.min * 1000 || metres > CUSTOM_KM.max * 1000) {
            return m.goal_issue_distance_range({ min: CUSTOM_KM.min, max: CUSTOM_KM.max });
        }
    }
    if (form.time.trim() && parseDuration(form.time) == null) {
        return m.goal_issue_time_format();
    }
    return null;
}
