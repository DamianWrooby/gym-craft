import { describe, expect, it } from 'vitest';
import { languageRule, withLanguage } from './prompt-language';

describe('languageRule', () => {
    it('adds nothing for English', () => {
        expect(languageRule('en')).toBe('');
        expect(withLanguage('System.', 'en')).toBe('System.');
    });

    it('asks for Polish and lists the shared terms', () => {
        const rule = languageRule('pl');
        expect(rule).toContain('in Polish');
        expect(rule).toContain('- Recovery budget: Budżet regeneracji');
        expect(rule).toContain('- Long run: Bieg długi');
        expect(withLanguage('System.', 'pl')).toBe(`System.\n\n${rule}`);
    });

    it('keeps JSON keys untranslated', () => {
        expect(languageRule('pl')).toContain('Keep JSON keys');
    });
});
