import { PUBLIC_APP_ENV } from '$env/static/public';
import { enabledLocales, isEnabledLocale, pickLocale, type Locale } from '@/constants/locale.constants';

/**
 * The request's locale (ADR 0028): the signed-in athlete's stored locale, else the best
 * match for the browser's languages. Only enabled locales are returned, so an unreleased
 * locale never reaches production even if it is stored.
 */
export function resolveRequestLocale(request: Request, user: App.Locals['user'] | undefined): Locale {
    const enabled = enabledLocales(PUBLIC_APP_ENV);
    if (user && isEnabledLocale(user.locale, enabled)) return user.locale;
    return pickLocale(request.headers.get('accept-language'), enabled);
}
