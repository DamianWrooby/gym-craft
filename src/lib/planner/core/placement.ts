// Placement rules (ADR 0026): the model places sessions, these hard rules reject a violating week.
import { m } from '$lib/paraglide/messages.js';
import { daysBetween } from '$lib/utils/iso-week';
import { WEEKDAYS, type AvailabilityMap } from '../wizard';
import type { TypedSession } from './session';

export interface PlacementContext {
    /** Monday of the plan week. */
    weekStart: string;
    /** First and last day inside the horizon (a partial week is narrower than Monday–Sunday). */
    from: string;
    to: string;
    availability: AvailabilityMap;
    /** 0 = Monday … 6 = Sunday. */
    longRunDay: number;
    /** The school's key-session keys; `long` is the long run. */
    keySessions: string[];
}

export const LONG_RUN_KEY = 'long';

const weekday = (date: string, ctx: PlacementContext) => daysBetween(ctx.weekStart, date);

const isKeyRun = (s: TypedSession, ctx: PlacementContext) =>
    s.kind === 'RUNNING' && s.body.keySession != null && ctx.keySessions.includes(s.body.keySession);

/** One line per broken rule; empty when the week is placeable as written. */
export function placementViolations(sessions: TypedSession[], ctx: PlacementContext): string[] {
    const violations: string[] = [];

    for (const s of sessions) {
        if (s.scheduledDate < ctx.from || s.scheduledDate > ctx.to) {
            violations.push(m.placement_outside_week({ date: s.scheduledDate }));
        } else if (!ctx.availability[WEEKDAYS[weekday(s.scheduledDate, ctx)]]) {
            violations.push(m.placement_not_training_day({ date: s.scheduledDate }));
        }
    }

    const longRuns = sessions.filter((s) => s.kind === 'RUNNING' && s.body.keySession === LONG_RUN_KEY);
    if (longRuns.some((s) => weekday(s.scheduledDate, ctx) !== ctx.longRunDay)) {
        violations.push(m.placement_long_run_day());
    }

    const keyDays = [...new Set(sessions.filter((s) => isKeyRun(s, ctx)).map((s) => weekday(s.scheduledDate, ctx)))];
    if (keyDays.some((d) => keyDays.includes(d + 1))) {
        violations.push(m.placement_consecutive_keys());
    }

    const heavyDays = sessions
        .filter((s) => s.kind === 'STRENGTH' && s.body.heavy)
        .map((s) => weekday(s.scheduledDate, ctx));
    if (heavyDays.some((d) => keyDays.includes(d + 1))) {
        violations.push('A heavy lift falls on the day before a key run');
    }

    if (sessions.some((s) => s.kind === 'STRENGTH' && weekday(s.scheduledDate, ctx) === ctx.longRunDay)) {
        violations.push('A lift falls on the long-run day');
    }

    if (daysBetween(ctx.from, ctx.to) === 6) {
        const busy = new Set(sessions.map((s) => s.scheduledDate));
        if (busy.size >= 7) violations.push(m.placement_rest_day());
    }

    return violations;
}
