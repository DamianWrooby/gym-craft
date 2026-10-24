import { describe, expect, it } from 'vitest';
import {
    classOf,
    defaultClass,
    formatDuration,
    fromGoal,
    goalFormIssue,
    parseDuration,
    toGoalInput,
} from './goal-form';

describe('target time', () => {
    it.each([
        ['1:45:00', 6300],
        ['45:30', 2730],
        [' 3:05:09 ', 11109],
    ])('reads %s as %i seconds', (text, sec) => {
        expect(parseDuration(text)).toBe(sec);
    });

    it.each(['', '90', '1:60', '1:5', 'abc', '0:00', '1:45:00:00'])('rejects %j', (text) => {
        expect(parseDuration(text)).toBeNull();
    });

    it.each([
        [6300, '1:45:00'],
        [2730, '45:30'],
    ])('shows %i seconds as %s', (sec, text) => {
        expect(formatDuration(sec)).toBe(text);
    });
});

describe('race class', () => {
    it.each([
        [1, 'A'],
        [2, 'B'],
        [3, 'C'],
        [5, 'C'],
    ] as const)('shows priority %i as %s', (priority, raceClass) => {
        expect(classOf(priority)).toBe(raceClass);
    });

    it('defaults to A when the athlete has no A race', () => {
        expect(
            defaultClass([
                { goalType: 'RACE', priority: 2 },
                { goalType: 'BASE_BUILDING', priority: 1 },
            ]),
        ).toBe('A');
    });

    it('defaults to B when an A race exists', () => {
        expect(defaultClass([{ goalType: 'RACE', priority: 1 }])).toBe('B');
    });
});

const race = {
    goalType: 'RACE' as const,
    targetEventName: 'Spring Half',
    targetEventDate: '2027-04-11',
    targetDistanceM: 21097,
    targetTimeSec: 6300,
    priority: 5,
    notes: null,
};

describe('a new goal', () => {
    it('saves a half-marathon A race', () => {
        const form = { ...fromGoal(null, []), distance: 'half' as const, date: '2027-04-11', time: '1:45:00' };
        expect(form).toMatchObject({ isRace: true, raceClass: 'A' });
        expect(toGoalInput(form, [])).toEqual({
            goalType: 'RACE',
            targetEventName: null,
            targetEventDate: '2027-04-11',
            targetDistanceM: 21097,
            targetTimeSec: 6300,
            priority: 1,
            notes: null,
        });
    });

    it('saves a custom distance in km as metres', () => {
        const form = { ...fromGoal(null, []), distance: 'custom' as const, customKm: '15.5', date: '2027-04-11' };
        expect(toGoalInput(form, []).targetDistanceM).toBe(15500);
    });

    it('saves no race with a null date, distance and time, after every other goal', () => {
        const others = [
            { goalType: 'RACE' as const, priority: 1 },
            { goalType: 'BASE_BUILDING' as const, priority: 4 },
        ];
        const form = { ...fromGoal(null, others), isRace: false, date: '2027-04-11', time: '1:45:00' };
        expect(toGoalInput(form, others)).toMatchObject({
            goalType: 'BASE_BUILDING',
            targetEventDate: null,
            targetDistanceM: null,
            targetTimeSec: null,
            priority: 5,
        });
    });
});

describe('an existing goal', () => {
    it('shows a priority 5 race as C and keeps 5 when saved unchanged', () => {
        const form = fromGoal(race, []);
        expect(form).toMatchObject({ isRace: true, distance: 'half', raceClass: 'C', time: '1:45:00' });
        expect(toGoalInput(form, []).priority).toBe(5);
    });

    it('stores the new class when the athlete changes it', () => {
        expect(toGoalInput({ ...fromGoal(race, []), raceClass: 'A' }, []).priority).toBe(1);
    });

    it('opens a custom distance as km', () => {
        expect(fromGoal({ ...race, targetDistanceM: 15500 }, [])).toMatchObject({
            distance: 'custom',
            customKm: '15.5',
        });
    });

    it('opens no race on its focus and keeps its priority', () => {
        const tempo = { ...race, goalType: 'TEMPO_WORK' as const, targetEventDate: null, priority: 3 };
        const form = fromGoal(tempo, []);
        expect(form).toMatchObject({ isRace: false, focus: 'TEMPO_WORK' });
        expect(toGoalInput(form, [{ goalType: 'RACE', priority: 9 }]).priority).toBe(3);
    });
});

describe('what blocks save', () => {
    const today = '2026-10-24';
    const valid = { ...fromGoal(race, []) };

    it('passes a valid race', () => {
        expect(goalFormIssue(valid, today)).toBeNull();
    });

    it.each([
        ['no date', { date: '' }, 'race date'],
        ['a date of today', { date: today }, 'after today'],
        ['a date in the past', { date: '2026-10-01' }, 'after today'],
        ['a custom distance under 1.5 km', { distance: 'custom' as const, customKm: '1.4' }, '1.5–42.2 km'],
        ['a custom distance over 42.2 km', { distance: 'custom' as const, customKm: '50' }, '1.5–42.2 km'],
        ['an empty custom distance', { distance: 'custom' as const, customKm: '' }, '1.5–42.2 km'],
        ['a bad time', { time: '1:75' }, 'h:mm:ss'],
        ['notes over 500 characters', { notes: 'x'.repeat(501) }, '500'],
    ])('blocks %s', (_, change, reason) => {
        expect(goalFormIssue({ ...valid, ...change }, today)).toContain(reason);
    });

    it('ignores the race fields when there is no race', () => {
        expect(goalFormIssue({ ...valid, isRace: false, date: '', time: 'bad' }, today)).toBeNull();
    });
});

describe('review fixes', () => {
    it('gives a no-race goal switched to a race the default class, not its stored priority', () => {
        const base = { ...race, goalType: 'BASE_BUILDING' as const, targetEventDate: null, priority: 1 };
        const others = [{ goalType: 'RACE' as const, priority: 1 }];
        const form = { ...fromGoal(base, others), isRace: true };
        expect(form.raceClass).toBe('B');
        expect(toGoalInput(form, others).priority).toBe(2);
    });

    it('reads a comma as the decimal mark in a custom distance', () => {
        const form = { ...fromGoal(race, []), distance: 'custom' as const, customKm: '1,5' };
        expect(goalFormIssue(form, '2026-10-24')).toBeNull();
        expect(toGoalInput(form, []).targetDistanceM).toBe(1500);
    });
});
