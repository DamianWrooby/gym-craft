import { describe, expect, it } from 'vitest';
import {
    ACTIVITY_DEFAULT_WINDOW_DAYS,
    ACTIVITY_MAX_SHOWN,
    ACTIVITY_PAGE_SIZE,
    activityListSearch,
    resolveActivityListQuery,
} from './activity-list-query';

const NOW = new Date('2026-08-08T14:30:00.000Z');

const query = (search: string) => resolveActivityListQuery(new URLSearchParams(search), NOW);

describe('resolveActivityListQuery', () => {
    describe('window', () => {
        it('defaults to a 90-day window ending today when the URL says nothing', () => {
            const { from, to } = query('');

            expect(to).toBe('2026-08-08');
            // Inclusive window: 2026-05-11 .. 2026-08-08 is 90 days.
            expect(from).toBe('2026-05-11');
            const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
            expect(days).toBe(ACTIVITY_DEFAULT_WINDOW_DAYS);
        });

        it('honours a valid from/to pair', () => {
            expect(query('from=2026-01-01&to=2026-02-15')).toMatchObject({
                from: '2026-01-01',
                to: '2026-02-15',
            });
        });

        it('accepts a single-day window', () => {
            expect(query('from=2026-03-03&to=2026-03-03')).toMatchObject({ from: '2026-03-03', to: '2026-03-03' });
        });

        it('bounds startTime to whole UTC days, inclusive at both ends', () => {
            const { rangeStart, rangeEnd } = query('from=2026-01-01&to=2026-02-15');

            expect(rangeStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
            expect(rangeEnd.toISOString()).toBe('2026-02-15T23:59:59.999Z');
        });

        it.each([
            ['from is missing', 'to=2026-02-15'],
            ['to is missing', 'from=2026-01-01'],
            ['from is after to', 'from=2026-05-01&to=2026-04-01'],
            ['a date is not ISO', 'from=01/01/2026&to=2026-02-15'],
            ['a date is unparseable', 'from=2026-13-45&to=2026-02-15'],
            ['a date is empty', 'from=&to=2026-02-15'],
        ])('falls back to the default window when %s', (_case, search) => {
            expect(query(search)).toMatchObject({ from: '2026-05-11', to: '2026-08-08' });
        });
    });

    describe('shown', () => {
        it('defaults to one page', () => {
            expect(query('').shown).toBe(ACTIVITY_PAGE_SIZE);
        });

        it('honours an exact multiple of the page size', () => {
            expect(query(`shown=${ACTIVITY_PAGE_SIZE * 3}`).shown).toBe(ACTIVITY_PAGE_SIZE * 3);
        });

        it('rounds a partial page up to a whole one', () => {
            expect(query('shown=21').shown).toBe(ACTIVITY_PAGE_SIZE * 2);
            expect(query('shown=39').shown).toBe(ACTIVITY_PAGE_SIZE * 2);
        });

        it('clamps to the ceiling so a hand-edited URL cannot ask for an unbounded read', () => {
            expect(query('shown=100000').shown).toBe(ACTIVITY_MAX_SHOWN);
        });

        it.each([
            ['zero', 'shown=0'],
            ['negative', 'shown=-40'],
            ['non-numeric', 'shown=lots'],
            ['empty', 'shown='],
            ['NaN-producing', 'shown=NaN'],
            ['Infinity', 'shown=Infinity'],
        ])('falls back to one page when shown is %s', (_case, search) => {
            expect(query(search).shown).toBe(ACTIVITY_PAGE_SIZE);
        });
    });
});

describe('activityListSearch', () => {
    it('omits shown for the first page, keeping the canonical URL clean', () => {
        expect(activityListSearch('2026-05-11', '2026-08-08', ACTIVITY_PAGE_SIZE)).toBe(
            '?from=2026-05-11&to=2026-08-08',
        );
    });

    it('includes shown once the user has loaded more', () => {
        expect(activityListSearch('2026-05-11', '2026-08-08', 60)).toBe('?from=2026-05-11&to=2026-08-08&shown=60');
    });

    it('round-trips back through the resolver', () => {
        const search = activityListSearch('2026-01-01', '2026-02-15', 80);

        expect(resolveActivityListQuery(new URLSearchParams(search), NOW)).toMatchObject({
            from: '2026-01-01',
            to: '2026-02-15',
            shown: 80,
        });
    });
});
