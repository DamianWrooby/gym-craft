import type { Cookies } from '@sveltejs/kit';
import type { Locale } from '@/constants/locale.constants';

import { cookieName } from '$lib/paraglide/runtime';

// The browser reads this cookie to pick the locale after hydration, so it must stay readable by scripts.
export const LOCALE_COOKIE = cookieName;

export function setLocaleCookie(cookies: Cookies, locale: Locale) {
    cookies.set(LOCALE_COOKIE, locale, { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 400 });
}
