// Lives in constants/ (not $lib/server) because the my-account switch imports it too (ADR 0028).

export const SUPPORTED_LOCALES = ['en', 'pl'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', pl: 'Polski' };

// A supported locale listed here stays hidden in production until its UI is translated.
const UNRELEASED_LOCALES: readonly Locale[] = [];

export function enabledLocales(appEnv: string | undefined): Locale[] {
    if (appEnv !== 'production') return [...SUPPORTED_LOCALES];
    return SUPPORTED_LOCALES.filter((locale) => !UNRELEASED_LOCALES.includes(locale));
}

export function isEnabledLocale(value: unknown, enabled: readonly Locale[]): value is Locale {
    return typeof value === 'string' && (enabled as readonly string[]).includes(value);
}

/** Best enabled locale for an `Accept-Language` header, else English. */
export function pickLocale(acceptLanguage: string | null, enabled: readonly Locale[]): Locale {
    if (!acceptLanguage) return DEFAULT_LOCALE;

    const ranked = acceptLanguage
        .split(',')
        .map((part) => {
            const [tag, ...params] = part.trim().split(';');
            const q = params.find((p) => p.trim().startsWith('q='));
            return { language: tag.trim().split('-')[0].toLowerCase(), quality: q ? Number(q.trim().slice(2)) : 1 };
        })
        .filter(({ quality }) => quality > 0)
        .sort((a, b) => b.quality - a.quality);

    return (ranked.find(({ language }) => isEnabledLocale(language, enabled))?.language as Locale) ?? DEFAULT_LOCALE;
}
