import { createResponse } from '$lib/utils/response';
import { getReportById } from '$lib/prisma/prisma';
import { buildReportMarkdown, type ExportableReport } from '$lib/server/reports/export-markdown';

export async function GET({
    params,
    locals,
}: {
    params: { id: string; reportId: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }
    if (locals.user.subscriptionTier !== 'SUPPORTER') {
        return createResponse(403, {
            code: 'UPGRADE_REQUIRED',
            message: 'Report export is a Supporter feature',
        });
    }

    const report = await getReportById(params.reportId, params.id);
    if (!report) {
        return createResponse(404, { code: 'REPORT_NOT_FOUND', message: 'Report not found' });
    }

    const markdown = buildReportMarkdown(report as unknown as ExportableReport);

    return new Response(markdown, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename="weekly-report-${report.periodStart}.md"`,
        },
    });
}
