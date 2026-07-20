import { error } from '@sveltejs/kit';
import { to } from 'await-to-js';
import { getReportById } from '$lib/prisma/prisma';

export async function load({ locals, params }) {
    const userId = locals.user?.id;
    if (!userId) error(401, 'Unauthorized');

    const [err, report] = await to(getReportById(params.id, userId));
    if (err) error(500, 'Cannot load report');
    if (!report) error(404, 'Report not found');

    return {
        report: {
            ...report,
            createdAt: report.createdAt.toISOString(),
        },
    };
}
