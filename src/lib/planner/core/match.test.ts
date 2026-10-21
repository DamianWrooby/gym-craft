import { describe, expect, it } from 'vitest';
import { activityKindOf, matchActivities, plannedDurationSec, type MatchActivity, type MatchSession } from './match';

const session = (over: Partial<MatchSession> & { id: string }): MatchSession => ({
    kind: 'RUNNING',
    date: '2026-10-19',
    durationSec: 3600,
    plannedLoad: 60,
    modality: null,
    marked: false,
    ...over,
});

const activity = (over: Partial<MatchActivity> & { id: string }): MatchActivity => ({
    kind: 'RUNNING',
    modality: null,
    date: '2026-10-19',
    startTime: '2026-10-19T07:00:00Z',
    durationSec: 3600,
    load: 60,
    ...over,
});

describe('matchActivities', () => {
    it.each([
        {
            name: 'links a same-day run',
            sessions: [session({ id: 's1' })],
            activities: [activity({ id: 'a1' })],
            links: [{ sessionId: 's1', activityId: 'a1' }],
            unscheduled: [],
        },
        {
            name: 'links a run moved by a day (story 63)',
            sessions: [session({ id: 's1', date: '2026-10-20' })],
            activities: [activity({ id: 'a1', date: '2026-10-21', startTime: '2026-10-21T07:00:00Z' })],
            links: [{ sessionId: 's1', activityId: 'a1' }],
            unscheduled: [],
        },
        {
            name: 'prefers the same day over a closer-fitting session on another day',
            sessions: [
                session({ id: 'mon', durationSec: 1800, plannedLoad: 30 }),
                session({ id: 'tue', date: '2026-10-20', durationSec: 3600 }),
            ],
            activities: [activity({ id: 'a1' })],
            links: [{ sessionId: 'mon', activityId: 'a1' }],
            unscheduled: [],
        },
        {
            name: 'prefers the nearest day',
            sessions: [session({ id: 'tue', date: '2026-10-20' }), session({ id: 'sun', date: '2026-10-25' })],
            activities: [activity({ id: 'a1', date: '2026-10-21', startTime: '2026-10-21T07:00:00Z' })],
            links: [{ sessionId: 'tue', activityId: 'a1' }],
            unscheduled: [],
        },
        {
            name: 'pairs two same-day runs by duration and density',
            sessions: [
                session({ id: 'long', durationSec: 5400, plannedLoad: 90 }),
                session({ id: 'short', durationSec: 1200, plannedLoad: 40 }),
            ],
            activities: [
                activity({ id: 'a-short', durationSec: 1300, load: 42 }),
                activity({ id: 'a-long', startTime: '2026-10-19T18:00:00Z', durationSec: 5200, load: 85 }),
            ],
            links: [
                { sessionId: 'short', activityId: 'a-short' },
                { sessionId: 'long', activityId: 'a-long' },
            ],
            unscheduled: [],
        },
        {
            name: 'gives a tie to the earlier start',
            sessions: [session({ id: 's1' })],
            activities: [
                activity({ id: 'late', startTime: '2026-10-19T18:00:00Z' }),
                activity({ id: 'early', startTime: '2026-10-19T07:00:00Z' }),
            ],
            links: [{ sessionId: 's1', activityId: 'early' }],
            unscheduled: ['late'],
        },
        {
            name: 'keeps same-day pairs before a neighbour claims the session',
            sessions: [session({ id: 'mon' }), session({ id: 'wed', date: '2026-10-21' })],
            activities: [
                activity({ id: 'tue', date: '2026-10-20', startTime: '2026-10-20T07:00:00Z', durationSec: 3500 }),
                activity({ id: 'a-wed', date: '2026-10-21', startTime: '2026-10-21T07:00:00Z' }),
            ],
            links: [
                { sessionId: 'wed', activityId: 'a-wed' },
                { sessionId: 'mon', activityId: 'tue' },
            ],
            unscheduled: [],
        },
        {
            name: 'settles a planned session before one marked by hand',
            sessions: [session({ id: 'marked', marked: true }), session({ id: 'planned', durationSec: 2400 })],
            activities: [activity({ id: 'a1' })],
            links: [{ sessionId: 'planned', activityId: 'a1' }],
            unscheduled: [],
        },
        {
            name: 'never crosses kinds',
            sessions: [session({ id: 's1', kind: 'STRENGTH' })],
            activities: [activity({ id: 'a1' })],
            links: [],
            unscheduled: ['a1'],
        },
        {
            name: 'links other training on the same day and modality',
            sessions: [session({ id: 's1', kind: 'OTHER', modality: 'ride' })],
            activities: [activity({ id: 'a1', kind: 'OTHER', modality: 'ride' })],
            links: [{ sessionId: 's1', activityId: 'a1' }],
            unscheduled: [],
        },
        {
            name: 'does not move other training to another day',
            sessions: [session({ id: 's1', kind: 'OTHER', modality: 'ride', date: '2026-10-20' })],
            activities: [activity({ id: 'a1', kind: 'OTHER', modality: 'ride' })],
            links: [],
            unscheduled: ['a1'],
        },
        {
            name: 'does not link other training of another modality',
            sessions: [session({ id: 's1', kind: 'OTHER', modality: 'swim' })],
            activities: [activity({ id: 'a1', kind: 'OTHER', modality: 'ride' })],
            links: [],
            unscheduled: ['a1'],
        },
        {
            name: 'pairs by load when a session has no planned duration',
            sessions: [
                session({ id: 'big', durationSec: null, plannedLoad: 120 }),
                session({ id: 'small', durationSec: null, plannedLoad: 30 }),
            ],
            activities: [activity({ id: 'a1', load: 110 })],
            links: [{ sessionId: 'big', activityId: 'a1' }],
            unscheduled: [],
        },
        {
            name: 'leaves extra activities unscheduled',
            sessions: [],
            activities: [activity({ id: 'a1' })],
            links: [],
            unscheduled: ['a1'],
        },
    ])('$name', ({ sessions, activities, links, unscheduled }) => {
        const result = matchActivities(sessions, activities);
        expect(result.links).toEqual(expect.arrayContaining(links));
        expect(result.links).toHaveLength(links.length);
        expect(result.unscheduled).toEqual(unscheduled);
    });
});

describe('activityKindOf', () => {
    it.each([
        { typeKey: 'running', kind: { kind: 'RUNNING', modality: null } },
        { typeKey: 'trail_running', kind: { kind: 'RUNNING', modality: null } },
        { typeKey: 'strength_training', kind: { kind: 'STRENGTH', modality: null } },
        { typeKey: 'road_biking', kind: { kind: 'OTHER', modality: 'ride' } },
        { typeKey: 'indoor_cycling', kind: { kind: 'OTHER', modality: 'ride' } },
        { typeKey: 'lap_swimming', kind: { kind: 'OTHER', modality: 'swim' } },
        { typeKey: 'hiking', kind: { kind: 'OTHER', modality: 'hike' } },
        { typeKey: 'yoga', kind: { kind: 'OTHER', modality: 'other' } },
        { typeKey: 'walking', kind: null },
    ])('reads $typeKey', ({ typeKey, kind }) => {
        expect(activityKindOf(typeKey)).toEqual(kind);
    });
});

describe('plannedDurationSec', () => {
    it('sums timed run steps, repeats included', () => {
        const body = {
            steps: [
                { label: 'E', durationSec: 600 },
                {
                    repeat: 3,
                    steps: [
                        { label: 'I', durationSec: 180 },
                        { label: 'E', durationSec: 120 },
                    ],
                },
            ],
        };
        expect(plannedDurationSec('RUNNING', body)).toBe(1500);
    });

    it('is unknown when a run step is set by distance', () => {
        expect(plannedDurationSec('RUNNING', { steps: [{ label: 'E', distanceM: 5000 }] })).toBeNull();
    });

    it('reads minutes from strength and other bodies', () => {
        expect(plannedDurationSec('STRENGTH', { durationMin: 45 })).toBe(2700);
        expect(plannedDurationSec('OTHER', { durationMin: 30 })).toBe(1800);
    });
});
