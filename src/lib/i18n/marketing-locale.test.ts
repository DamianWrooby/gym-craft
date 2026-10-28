import { describe, expect, it } from 'vitest';
import { marketingLocale, marketingPath } from './marketing-locale';

describe('marketingLocale', () => {
    it('reads English from unprefixed marketing pages', () => {
        expect(marketingLocale('/')).toBe('en');
        expect(marketingLocale('/privacy-policy')).toBe('en');
    });

    it('reads Polish from the /pl prefix', () => {
        expect(marketingLocale('/pl')).toBe('pl');
        expect(marketingLocale('/pl/')).toBe('pl');
        expect(marketingLocale('/pl/terms-of-use')).toBe('pl');
    });

    it('leaves app and other pages to the stored locale', () => {
        expect(marketingLocale('/app/plan')).toBeUndefined();
        expect(marketingLocale('/verification-mail-sent')).toBeUndefined();
        expect(marketingLocale('/pl/app')).toBeUndefined();
    });
});

describe('marketingPath', () => {
    it('switches between the English and Polish URL of a page', () => {
        expect(marketingPath('/', 'pl')).toBe('/pl');
        expect(marketingPath('/pl', 'en')).toBe('/');
        expect(marketingPath('/terms-of-use', 'pl')).toBe('/pl/terms-of-use');
        expect(marketingPath('/pl/terms-of-use', 'en')).toBe('/terms-of-use');
        expect(marketingPath('/pl/terms-of-use', 'pl')).toBe('/pl/terms-of-use');
    });
});
