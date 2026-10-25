import type { Cookies } from '@sveltejs/kit';
import { PUBLIC_APP_ENV } from '$env/static/public';
import { db } from '$lib/database';
import { createResponse } from '$lib/utils/response';
import { setLocaleCookie } from '$lib/server/i18n/locale-cookie';
import { enabledLocales, isEnabledLocale } from '@/constants/locale.constants';

/** Sets the athlete's locale (ADR 0028) and mirrors it into the cookie the browser reads. */
export async function PUT({
    request,
    params,
    locals,
    cookies,
}: {
    request: Request;
    params: { id: string };
    locals: App.Locals;
    cookies: Cookies;
}): Promise<Response> {
    if (params.id !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }

    const body = await request.json().catch(() => null);
    const locale = body?.locale;
    const enabled = enabledLocales(PUBLIC_APP_ENV);
    if (!isEnabledLocale(locale, enabled)) {
        return createResponse(400, { code: 'INVALID_LOCALE', message: `Locale must be one of: ${enabled.join(', ')}` });
    }

    await db.user.update({ where: { id: params.id }, data: { locale } });
    setLocaleCookie(cookies, locale);
    return createResponse(200, { data: { locale } });
}
