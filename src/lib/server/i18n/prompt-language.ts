// AI text follows the locale at write time (ADR 0028). Every prompt appends this rule, so the model
// writes in the athlete's language and names training ideas with the same terms as the UI.
import { getLocale } from '$lib/paraglide/runtime';
import type { Locale } from '@/constants/locale.constants';
import { TERMS } from '$lib/i18n/terms';

const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', pl: 'Polish' };

/** The language rule for a system prompt; empty for English, the language every prompt is written in. */
export function languageRule(locale: Locale = getLocale()): string {
    if (locale === 'en') return '';
    const terms = Object.values(TERMS).map((t) => `- ${t.en}: ${t[locale]}`);
    return [
        `Language: write every word the athlete reads in ${LANGUAGE_NAMES[locale]}, including headings, titles and notes.`,
        'Keep JSON keys, key values and code-formatted text exactly as given. Do not translate them.',
        `Use these terms for training ideas:\n${terms.join('\n')}`,
    ].join('\n');
}

/** Appends the language rule to a system prompt. */
export const withLanguage = (system: string, locale?: Locale): string => {
    const rule = languageRule(locale);
    return rule ? `${system}\n\n${rule}` : system;
};
