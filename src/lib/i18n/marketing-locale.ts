// Marketing pages take their locale from the URL (ADR 0028): English at `/`, Polish at `/pl/...`.
// They are prerendered, so neither the stored locale nor the cookie may decide them.
import type { Locale } from '@/constants/locale.constants';

export const MARKETING_LOCALE_PREFIXES = ['pl'] as const satisfies readonly Exclude<Locale, 'en'>[];

/** Marketing paths below the locale prefix. */
const MARKETING_PATHS = ['/', '/privacy-policy', '/terms-of-use'];

/** The locale a marketing URL names, or undefined for any other page. */
export function marketingLocale(pathname: string): Locale | undefined {
    const [, first = '', ...rest] = pathname.split('/');
    const prefixed = (MARKETING_LOCALE_PREFIXES as readonly string[]).includes(first);
    const below = prefixed ? `/${rest.join('/')}` : pathname;
    const path = below.length > 1 ? below.replace(/\/$/, '') : below;
    if (!MARKETING_PATHS.includes(path)) return undefined;
    return prefixed ? (first as Locale) : 'en';
}

/** The same marketing page in another locale. */
export function marketingPath(pathname: string, locale: Locale): string {
    const [, first = ''] = pathname.split('/');
    const base = (MARKETING_LOCALE_PREFIXES as readonly string[]).includes(first)
        ? pathname.slice(first.length + 1) || '/'
        : pathname;
    if (locale === 'en') return base;
    return base === '/' ? `/${locale}` : `/${locale}${base}`;
}
