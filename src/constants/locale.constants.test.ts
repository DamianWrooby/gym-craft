import { describe, expect, it } from 'vitest';
import { enabledLocales, isEnabledLocale, pickLocale } from './locale.constants';

describe('enabledLocales', () => {
    it('hides Polish in production', () => {
        expect(enabledLocales('production')).toEqual(['en']);
    });

    it('shows Polish outside production', () => {
        expect(enabledLocales('development')).toEqual(['en', 'pl']);
    });
});

describe('isEnabledLocale', () => {
    it('accepts an enabled locale only', () => {
        expect(isEnabledLocale('pl', ['en', 'pl'])).toBe(true);
        expect(isEnabledLocale('pl', ['en'])).toBe(false);
        expect(isEnabledLocale('de', ['en', 'pl'])).toBe(false);
        expect(isEnabledLocale(42, ['en'])).toBe(false);
    });
});

describe('pickLocale', () => {
    const enabled = ['en', 'pl'] as const;

    it('falls back to English without a header', () => {
        expect(pickLocale(null, [...enabled])).toBe('en');
    });

    it('picks the first enabled language by quality', () => {
        expect(pickLocale('de-DE,de;q=0.9,pl;q=0.8,en;q=0.7', [...enabled])).toBe('pl');
    });

    it('matches a regional tag to its language', () => {
        expect(pickLocale('pl-PL', [...enabled])).toBe('pl');
    });

    it('honours quality over header order', () => {
        expect(pickLocale('en;q=0.5,pl;q=0.9', [...enabled])).toBe('pl');
    });

    it('ignores a disabled language', () => {
        expect(pickLocale('pl-PL,pl;q=0.9', ['en'])).toBe('en');
    });
});
