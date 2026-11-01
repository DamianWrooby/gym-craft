import { m } from '$lib/paraglide/messages.js';
import { error } from '@sveltejs/kit';
import { to } from 'await-to-js';
import { getReportById } from '$lib/prisma/prisma';

export async function load({ locals, params }) {
    const userId = locals.user?.id;
    if (!userId) error(401, m.api_unauthorized());

    const [err, report] = await to(getReportById(params.id, userId));
    if (err) error(500, m.page_report_load_failed());
    if (!report) error(404, m.api_report_not_found());

    return {
        report: {
            ...report,
            createdAt: report.createdAt.toISOString(),
        },
    };
}
