import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const OLD_ANALYTICS_ROOT = 'analytics';

/** Keeps bookmarks to the old running area working (ADR 0030). The query string carries list filters. */
export const GET: RequestHandler = ({ params, url }) => {
    const { rest } = params;
    if (rest !== '' && rest !== OLD_ANALYTICS_ROOT && !rest.startsWith(`${OLD_ANALYTICS_ROOT}/`)) {
        error(404, 'Not found');
    }
    const suffix = rest.slice(OLD_ANALYTICS_ROOT.length);
    redirect(301, `/app/analytics${suffix}${url.search}`);
};
