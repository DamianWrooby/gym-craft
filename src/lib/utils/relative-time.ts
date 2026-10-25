import { getLocale } from '$lib/paraglide/runtime.js';

/** "5 min ago", "3 hr. ago", "yesterday"… in the request's locale. */
export function formatRelativeTime(iso: string, now = Date.now()): string {
    const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto', style: 'short' });
    const diffMin = Math.round((now - new Date(iso).getTime()) / 60000);
    if (diffMin < 60) return rtf.format(-diffMin, 'minute');
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return rtf.format(-diffHr, 'hour');
    return rtf.format(-Math.round(diffHr / 24), 'day');
}
