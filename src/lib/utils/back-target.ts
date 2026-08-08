/**
 * Resolves where a detail page's "back" button should navigate.
 *
 * Detail pages under /app/running/analytics are reachable from more than one
 * place (the dashboard preview and the full list). The back button should
 * return to wherever the user actually came from, so we use the referring
 * path when it is inside the analytics area and fall back to the list page
 * otherwise (e.g. deep links or a full-page refresh, where there is no
 * in-app referrer).
 *
 * `fromPath` may carry a query string — the list page stores its date window and
 * revealed row count there — and it is preserved verbatim so the user returns to
 * the list as they left it.
 */
export function resolveBackTarget(fromPath: string | null | undefined, fallback: string): string {
    if (fromPath && fromPath.startsWith('/app/running/analytics')) {
        return fromPath;
    }
    return fallback;
}
