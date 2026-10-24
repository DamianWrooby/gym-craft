import { describe, expect, it } from 'vitest';
import { addDays } from '$lib/utils/iso-week';
import {
    detectDrift,
    movedSessions,
    recutSuggestionShown,
    reevaluate,
    type DriftWeek,
    type ReevalSession,
} from './revision';

const today = '2026-10-21'; // Wednesday

const s = (over: Partial<ReevalSession> & Pick<ReevalSession, 'id'>): ReevalSession => ({
    origin: 'AI',
    status: 'PLANNED',
    scheduledDate: '2026-10-23',
    plannedLoad: 50,
    actualLoad: null,
    keySession: null,
    ...over,
});

const week = [
    s({ id: 'mon', scheduledDate: '2026-10-19', status: 'DONE', actualLoad: 60 }),
    s({ id: 'tue', scheduledDate: '2026-10-20', status: 'DONE', keySession: 'intervals' }),
    s({ id: 'thu', scheduledDate: '2026-10-22' }),
    s({ id: 'sat', scheduledDate: '2026-10-24', keySession: 'long_run', plannedLoad: 80 }),
    s({ id: 'sun', scheduledDate: '2026-10-25', origin: 'ATHLETE', plannedLoad: 30 }),
];

describe('reevaluate', () => {
    it.each([
        {
            name: 'no change when executed plus remaining fits the budget',
            input: { budget: 300, sessions: week, unscheduledLoad: 0, trigger: 'SESSION_DONE' as const },
            kind: 'no-change',
            scope: [],
        },
        {
            name: 'no change when ungated and nothing key was missed',
            input: { budget: null, sessions: week, unscheduledLoad: 500, trigger: 'UNSCHEDULED' as const },
            kind: 'no-change',
            scope: [],
        },
        {
            name: 'revises the remaining AI sessions when an unscheduled activity pushes the week over',
            input: { budget: 300, sessions: week, unscheduledLoad: 60, trigger: 'UNSCHEDULED' as const },
            kind: 'revise',
            scope: ['thu', 'sat'],
        },
        {
            name: 'revises when a key session was skipped, even within budget',
            input: {
                budget: 1000,
                sessions: week.map((x) => (x.id === 'tue' ? { ...x, status: 'SKIPPED' as const } : x)),
                unscheduledLoad: 0,
                trigger: 'SESSION_SKIPPED' as const,
            },
            kind: 'revise',
            scope: ['thu', 'sat'],
        },
        {
            name: 'treats a past key session still planned as missed',
            input: {
                budget: null,
                sessions: week.map((x) => (x.id === 'tue' ? { ...x, status: 'PLANNED' as const } : x)),
                unscheduledLoad: 0,
                trigger: 'SESSION_DONE' as const,
            },
            kind: 'revise',
            scope: ['thu', 'sat'],
        },
        {
            name: 'ignores a missed key session the last revision already absorbed',
            input: {
                budget: null,
                sessions: week.map((x) => (x.id === 'tue' ? { ...x, status: 'SKIPPED' as const } : x)),
                unscheduledLoad: 0,
                trigger: 'SESSION_DONE' as const,
                lastRevisedOn: '2026-10-21',
            },
            kind: 'no-change',
            scope: [],
        },
        {
            name: 'asks when over budget and only athlete sessions remain',
            input: {
                budget: 100,
                sessions: week.filter((x) => x.origin === 'ATHLETE' || x.status === 'DONE'),
                unscheduledLoad: 0,
                trigger: 'UNSCHEDULED' as const,
            },
            kind: 'ask',
            scope: [],
        },
        {
            name: 'an athlete request may rewrite athlete sessions too',
            input: { budget: 1000, sessions: week, unscheduledLoad: 0, trigger: 'ATHLETE' as const },
            kind: 'revise',
            scope: ['thu', 'sat', 'sun'],
        },
        {
            name: 'an athlete request with nothing left changes nothing',
            input: {
                budget: 1000,
                sessions: week.filter((x) => x.status === 'DONE'),
                unscheduledLoad: 0,
                trigger: 'ATHLETE' as const,
            },
            kind: 'no-change',
            scope: [],
        },
    ])('$name', ({ input, kind, scope }) => {
        const result = reevaluate({ today, lastRevisedOn: null, ...input });
        expect(result.kind).toBe(kind);
        expect(result.scope).toEqual(scope);
    });

    it('states the cause in numbers: linked actual load wins over planned', () => {
        const result = reevaluate({
            today,
            budget: 300,
            sessions: week,
            unscheduledLoad: 60,
            trigger: 'UNSCHEDULED',
            lastRevisedOn: null,
        });
        expect(result.reason).toEqual({
            executedLoad: 170, // 60 actual + 50 planned + 60 unscheduled
            remainingLoad: 160,
            budget: 300,
            overspend: 30,
            missedKeySessions: [],
        });
    });

    it('never rewrites a session today that is already done', () => {
        const result = reevaluate({
            today,
            budget: 0,
            sessions: [s({ id: 'wed', scheduledDate: today, status: 'DONE' }), s({ id: 'wed2', scheduledDate: today })],
            unscheduledLoad: 0,
            trigger: 'SESSION_DONE',
            lastRevisedOn: null,
        });
        expect(result.scope).toEqual(['wed2']);
    });
});

describe('detectDrift', () => {
    const w = (startDate: string, over: Partial<DriftWeek> = {}): DriftWeek => ({
        startDate,
        endDate: addDays(startDate, 6),
        decision: null,
        keySessionsSkipped: 0,
        ...over,
    });
    const today = '2026-10-21';
    // Three finished weeks before the current one (2026-10-19).
    const w1 = '2026-09-28';
    const w2 = '2026-10-05';
    const w3 = '2026-10-12';

    it.each([
        { name: 'no drift on a clean history', weeks: [w(w1), w(w2), w(w3)], drifting: false },
        {
            name: 'one sick week is ignored',
            weeks: [w(w1), w(w2, { keySessionsSkipped: 2 }), w(w3)],
            drifting: false,
        },
        {
            name: 'drops in 2 of the last 3 weeks drift',
            weeks: [w(w1, { decision: 'DROPPED' }), w(w2), w(w3, { keySessionsSkipped: 1 })],
            drifting: true,
        },
        {
            name: 'an override (kept over budget) counts as drift',
            weeks: [w(w1), w(w2, { decision: 'KEPT' }), w(w3, { decision: 'DOWNGRADED' })],
            drifting: true,
        },
        {
            name: 'the current, unfinished week does not count',
            weeks: [w(w2), w(w3, { decision: 'DROPPED' }), w('2026-10-19', { decision: 'DROPPED' })],
            drifting: false,
        },
        {
            name: 'only the last 3 finished weeks count',
            weeks: [w('2026-09-21', { decision: 'DROPPED' }), w(w1, { decision: 'DROPPED' }), w(w2), w(w3)],
            drifting: false,
        },
        {
            name: 'a decision still pending is not drift',
            weeks: [w(w2, { decision: 'PENDING' }), w(w3, { decision: 'PENDING' })],
            drifting: false,
        },
    ])('$name', ({ weeks, drifting }) => {
        expect(detectDrift(weeks, today).drifting).toBe(drifting);
    });

    it('names the latest drifting week, so a dismissal holds until drift continues', () => {
        const drift = detectDrift([w(w1, { decision: 'DROPPED' }), w(w2, { keySessionsSkipped: 1 }), w(w3)], today);
        expect(drift).toEqual({ drifting: true, driftWeeks: 2, latestWeekStart: w2 });
    });
});

describe('recutSuggestionShown', () => {
    const drift = { drifting: true, driftWeeks: 2, latestWeekStart: '2026-10-12' };
    it.each([
        { name: 'shown when never dismissed', dismissedFor: null, shown: true },
        { name: 'hidden after a dismissal for the same drift', dismissedFor: '2026-10-12', shown: false },
        { name: 'returns when drift continues into a new week', dismissedFor: '2026-10-05', shown: true },
    ])('$name', ({ dismissedFor, shown }) => {
        expect(recutSuggestionShown(drift, dismissedFor)).toBe(shown);
    });

    it('hidden without drift', () => {
        expect(recutSuggestionShown({ drifting: false, driftWeeks: 1, latestWeekStart: null }, null)).toBe(false);
    });
});

describe('movedSessions (ADR 0026)', () => {
    const tempo = { title: 'Tempo', keySession: 'tempo', date: '2026-10-20' };
    const easy = { title: 'Easy run', keySession: null, date: '2026-10-21' };

    it('names a key session the rewrite moved, matched by its key even when renamed', () => {
        const after = [{ ...tempo, title: 'Tempo 3 × 8 min', date: '2026-10-22' }, easy];
        expect(movedSessions([tempo, easy], after)).toEqual(['Tempo moved from Tuesday to Thursday.']);
    });

    it('matches a non-key session by title', () => {
        expect(movedSessions([easy], [{ ...easy, date: '2026-10-23' }])).toEqual([
            'Easy run moved from Wednesday to Friday.',
        ]);
    });

    it('says nothing for a session that stays on its day, or one the rewrite dropped', () => {
        expect(movedSessions([tempo, easy], [tempo])).toEqual([]);
    });
});
