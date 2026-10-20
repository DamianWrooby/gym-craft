import { describe, expect, it } from 'vitest';
import { placementViolations, type PlacementContext } from './placement';
import type { TypedSession } from './session';

// Week of Monday 2026-10-19; long-run day Sunday.
const ctx: PlacementContext = {
    weekStart: '2026-10-19',
    from: '2026-10-19',
    to: '2026-10-25',
    availability: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
    longRunDay: 6,
    keySessions: ['q1', 'q2', 'long'],
};

const day = (n: number) => `2026-10-${19 + n}`;

const runOn = (n: number, keySession: string | null = null): TypedSession => ({
    kind: 'RUNNING',
    scheduledDate: day(n),
    sequence: 0,
    body: {
        bodyVersion: 1,
        title: 'Run',
        keySession,
        reason: null,
        cutKey: null,
        steps: [{ label: 'E', durationSec: 1800 }],
    },
});

const liftOn = (n: number, heavy: boolean): TypedSession => ({
    kind: 'STRENGTH',
    scheduledDate: day(n),
    sequence: 1,
    body: { bodyVersion: 1, title: 'Lift', template: 't', heavy, durationMin: 45, exercises: [] },
});

// Tue Q1, Thu Q2, Sun long run, Mon light lift, rest on Wed/Fri/Sat.
const goodWeek = [liftOn(0, false), runOn(1, 'q1'), runOn(3, 'q2'), runOn(6, 'long')];

describe('placementViolations', () => {
    it('accepts a week that keeps every rule', () => {
        expect(placementViolations(goodWeek, ctx)).toEqual([]);
    });

    it('puts the long run on the long-run day', () => {
        const week = [runOn(1, 'q1'), runOn(3, 'q2'), runOn(5, 'long')];
        expect(placementViolations(week, ctx)).toEqual([expect.stringMatching(/long run/i)]);
    });

    it('never puts two key sessions on consecutive days', () => {
        const week = [runOn(1, 'q1'), runOn(2, 'q2'), runOn(6, 'long')];
        expect(placementViolations(week, ctx)).toEqual([expect.stringMatching(/consecutive/i)]);
    });

    it('never puts a heavy lift on the day before a key run', () => {
        expect(placementViolations([liftOn(0, true), ...goodWeek.slice(1)], ctx)).toEqual([
            expect.stringMatching(/heavy lift/i),
        ]);
    });

    it('lets a light lift sit before a key run, and a lift share a day with a key run', () => {
        expect(placementViolations([liftOn(0, false), liftOn(1, true), ...goodWeek.slice(1)], ctx)).toEqual([]);
    });

    it('never puts a lift on the long-run day', () => {
        expect(placementViolations([...goodWeek, liftOn(6, false)], ctx)).toEqual([
            expect.stringMatching(/long-run day/i),
        ]);
    });

    it('keeps at least one rest day in a full week', () => {
        const week = [0, 1, 2, 3, 4, 5].map((n) => runOn(n)).concat(runOn(6, 'long'));
        expect(placementViolations(week, ctx)).toEqual([expect.stringMatching(/rest day/i)]);
    });

    it('does not ask a partial week for a rest day', () => {
        const partial = { ...ctx, from: day(4) };
        expect(placementViolations([runOn(4), runOn(5), runOn(6, 'long')], partial)).toEqual([]);
    });

    it('keeps sessions on available days inside the horizon', () => {
        const limited = { ...ctx, from: day(1), availability: { ...ctx.availability, thu: false } };
        const week = [runOn(0), runOn(1, 'q1'), runOn(3, 'q2'), runOn(6, 'long')];
        expect(placementViolations(week, limited)).toEqual([
            expect.stringMatching(/2026-10-19.*outside/i),
            expect.stringMatching(/2026-10-22.*not a training day/i),
        ]);
    });
});
