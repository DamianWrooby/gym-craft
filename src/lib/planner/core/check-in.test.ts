import { describe, expect, it } from 'vitest';
import { checkInProposal, readCheckIn, type CheckIn } from './check-in';

const weekStart = '2026-10-19';
const today = '2026-10-22';
const c = (date: string, feeling: CheckIn['feeling'], reason: CheckIn['reason'] = null): CheckIn => ({
    date,
    feeling,
    reason,
});

describe('checkInProposal', () => {
    it.each([
        { name: 'nothing without check-ins', checkIns: [], after: null, proposed: false },
        {
            name: 'one poor day is not enough',
            checkIns: [c('2026-10-20', 'POOR', 'TIRED')],
            after: null,
            proposed: false,
        },
        {
            name: 'two poor days propose a revision',
            checkIns: [c('2026-10-20', 'POOR'), c('2026-10-22', 'POOR', 'SORE')],
            after: null,
            proposed: true,
        },
        {
            name: 'one ill day proposes a revision',
            checkIns: [c('2026-10-21', 'POOR', 'ILL')],
            after: null,
            proposed: true,
        },
        {
            name: 'so-so days never count',
            checkIns: [c('2026-10-20', 'SO_SO'), c('2026-10-21', 'SO_SO')],
            after: null,
            proposed: false,
        },
        {
            name: 'last week does not count',
            checkIns: [c('2026-10-17', 'POOR'), c('2026-10-20', 'POOR')],
            after: null,
            proposed: false,
        },
        {
            name: 'days up to a dismissal or revision are spent',
            checkIns: [c('2026-10-20', 'POOR'), c('2026-10-21', 'POOR', 'ILL'), c('2026-10-22', 'POOR')],
            after: '2026-10-21',
            proposed: false,
        },
    ])('$name', ({ checkIns, after, proposed }) => {
        expect(checkInProposal(checkIns, { weekStart, today, after }).proposed).toBe(proposed);
    });

    it('names the days behind the proposal', () => {
        const result = checkInProposal([c('2026-10-20', 'POOR'), c('2026-10-22', 'POOR', 'SORE')], {
            weekStart,
            today,
            after: null,
        });
        expect(result).toEqual({ proposed: true, poorDays: 2, illDay: false });
    });
});

describe('readCheckIn', () => {
    it('accepts a feeling and a reason on poor', () => {
        expect(readCheckIn({ feeling: 'POOR', reason: 'ILL' })).toEqual({ ok: true, feeling: 'POOR', reason: 'ILL' });
    });
    it('drops a reason on a good day', () => {
        expect(readCheckIn({ feeling: 'GOOD', reason: 'ILL' })).toEqual({ ok: true, feeling: 'GOOD', reason: null });
    });
    it.each([{}, { feeling: 'GREAT' }, { feeling: 'POOR', reason: 'BORED' }])('rejects %j', (raw) => {
        expect(readCheckIn(raw).ok).toBe(false);
    });
});
