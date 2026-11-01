import { describe, expect, it } from 'vitest';
import { GET } from './+server';

type GetEvent = Parameters<typeof GET>[0];

function run(rest: string, search = '') {
    const url = new URL(`http://localhost/app/running/${rest}${search}`);
    return GET({ params: { rest }, url } as unknown as GetEvent);
}

function thrownBy(action: () => unknown): { status: number; location?: string } {
    try {
        action();
    } catch (thrown) {
        return thrown as { status: number; location?: string };
    }
    throw new Error('expected the handler to throw');
}

describe('GET /app/running/[...rest]', () => {
    it.each([
        ['', '/app/analytics'],
        ['analytics', '/app/analytics'],
        ['analytics/activities', '/app/analytics/activities'],
        ['analytics/activities/111', '/app/analytics/activities/111'],
        ['analytics/reports/abc', '/app/analytics/reports/abc'],
    ])('redirects "%s" to %s', (rest, location) => {
        expect(thrownBy(() => run(rest))).toMatchObject({ status: 301, location });
    });

    it('keeps the query string', () => {
        expect(thrownBy(() => run('analytics/activities', '?from=2026-05-01&shown=60'))).toMatchObject({
            location: '/app/analytics/activities?from=2026-05-01&shown=60',
        });
    });

    it.each(['other', 'analyticsfoo'])('returns 404 for the unknown path "%s"', (rest) => {
        expect(thrownBy(() => run(rest))).toMatchObject({ status: 404 });
    });
});
