import { describe, expect, it } from 'vitest';
import { resolveBackTarget } from './back-target';

const FALLBACK = '/app/running/analytics/activities';

describe('resolveBackTarget', () => {
    it('returns the referrer when it is the analytics dashboard', () => {
        expect(resolveBackTarget('/app/running/analytics', FALLBACK)).toBe('/app/running/analytics');
    });

    it('returns the referrer when it is the list page', () => {
        expect(resolveBackTarget('/app/running/analytics/activities', FALLBACK)).toBe(
            '/app/running/analytics/activities',
        );
    });

    it('preserves the list query string so the window and revealed rows survive', () => {
        expect(
            resolveBackTarget('/app/running/analytics/activities?from=2026-05-01&to=2026-08-08&shown=60', FALLBACK),
        ).toBe('/app/running/analytics/activities?from=2026-05-01&to=2026-08-08&shown=60');
    });

    it('falls back when there is no referrer (deep link / refresh)', () => {
        expect(resolveBackTarget(null, FALLBACK)).toBe(FALLBACK);
        expect(resolveBackTarget(undefined, FALLBACK)).toBe(FALLBACK);
    });

    it('falls back when the referrer is outside the analytics area', () => {
        expect(resolveBackTarget('/app/gym/my-plans', FALLBACK)).toBe(FALLBACK);
    });
});
