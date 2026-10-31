import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { defineCustomServerStrategy } from '$lib/paraglide/runtime';
import { marketingLocale } from '$lib/i18n/marketing-locale';
import type { Locale } from '@/constants/locale.constants';
import { LOCALE_COOKIE, setLocaleCookie } from './locale-cookie';
import { resolveRequestLocale } from './resolve-locale';

// Paraglide asks the strategy with the same Request object the hook hands it.
const resolvedLocales = new WeakMap<Request, Locale>();

defineCustomServerStrategy('custom-marketing', {
    getLocale: (request) => (request ? marketingLocale(new URL(request.url).pathname) : undefined),
});

defineCustomServerStrategy('custom-resolved', {
    getLocale: (request) => (request ? resolvedLocales.get(request) : undefined),
});

/** Runs after the auth hook, so `locals.user` is already set for a signed-in athlete. */
export const i18nHandle: Handle = ({ event, resolve }) => {
    const locale = resolveRequestLocale(event.request, event.locals.user);
    resolvedLocales.set(event.request, locale);
    if (event.cookies.get(LOCALE_COOKIE) !== locale) setLocaleCookie(event.cookies, locale);

    return paraglideMiddleware(event.request, ({ request, locale }) => {
        event.request = request;
        return resolve(event, {
            transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale),
        });
    });
};
