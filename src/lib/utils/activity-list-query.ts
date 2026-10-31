import { toIsoDate } from '$lib/utils/iso-week';

/**
 * URL -> bounded query for the activities list page.
 *
 * The list used to load every activity row the user owned and let the browser filter and
 * paginate. Both bounds now live in the URL so a scroll position survives a reload and a
 * return trip from an activity detail page: `from`/`to` fix the window, `shown` records how
 * many rows the user has revealed with "Load more".
 *
 * `shown` (rather than an opaque cursor) is what makes the URL restorable — re-issuing the
 * same query rebuilds the exact list the user was looking at. Taking `shown` rows from the
 * top each time also side-steps offset drift: a sync landing mid-browse cannot make a row
 * appear twice or vanish, which `skip` would.
 *
 * Lives in `utils` rather than `$lib/server` because the list page imports it to build the
 * next "Load more" URL, so it has to survive the client bundle.
 */

/** Rows revealed per "Load more", and the initial page size. */
export const ACTIVITY_PAGE_SIZE = 20;

/**
 * Hard ceiling on `shown`, so a hand-edited URL cannot ask for an unbounded read. Reaching
 * it is surfaced in the UI as a prompt to narrow the date range — never a silent truncation.
 */
export const ACTIVITY_MAX_SHOWN = 500;

/** How far back the window reaches when the URL does not say. Covers the FREE backfill. */
export const ACTIVITY_DEFAULT_WINDOW_DAYS = 90;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export interface ActivityListQuery {
    /** Inclusive window start, as `yyyy-mm-dd`. */
    from: string;
    /** Inclusive window end, as `yyyy-mm-dd`. */
    to: string;
    /** How many rows to reveal. Always a multiple of `ACTIVITY_PAGE_SIZE`. */
    shown: number;
    /** `from` at 00:00:00.000 UTC — the `gte` bound for `startTime`. */
    rangeStart: Date;
    /** `to` at 23:59:59.999 UTC — the `lte` bound for `startTime`. */
    rangeEnd: Date;
}

function isValidIsoDate(value: string | null): value is string {
    return !!value && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function resolveWindow(params: URLSearchParams, now: Date): { from: string; to: string } {
    const from = params.get('from');
    const to = params.get('to');

    // Only an internally consistent pair is honoured; anything else falls back to the
    // default window rather than erroring, since these values come from a shareable URL.
    if (isValidIsoDate(from) && isValidIsoDate(to) && from <= to) {
        return { from, to };
    }

    const to_ = toIsoDate(now);
    const spanMs = (ACTIVITY_DEFAULT_WINDOW_DAYS - 1) * MS_PER_DAY;
    const from_ = toIsoDate(new Date(Date.parse(`${to_}T00:00:00.000Z`) - spanMs));
    return { from: from_, to: to_ };
}

function resolveShown(raw: string | null): number {
    const parsed = Number(raw);
    if (!raw || !Number.isFinite(parsed)) return ACTIVITY_PAGE_SIZE;

    // Round up to a whole page so "Load more" always advances by a full batch, and clamp
    // both ends: below a page is meaningless, above the ceiling is a read we refuse to do.
    const pages = Math.ceil(parsed / ACTIVITY_PAGE_SIZE);
    const maxPages = ACTIVITY_MAX_SHOWN / ACTIVITY_PAGE_SIZE;
    return Math.min(Math.max(pages, 1), maxPages) * ACTIVITY_PAGE_SIZE;
}

export function resolveActivityListQuery(params: URLSearchParams, now: Date = new Date()): ActivityListQuery {
    const { from, to } = resolveWindow(params, now);

    return {
        from,
        to,
        shown: resolveShown(params.get('shown')),
        rangeStart: new Date(`${from}T00:00:00.000Z`),
        rangeEnd: new Date(`${to}T23:59:59.999Z`),
    };
}

/** Builds the query string for a list URL, omitting `shown` when it is the initial page. */
export function activityListSearch(from: string, to: string, shown: number): string {
    const params = new URLSearchParams({ from, to });
    if (shown > ACTIVITY_PAGE_SIZE) params.set('shown', String(shown));
    return `?${params.toString()}`;
}
