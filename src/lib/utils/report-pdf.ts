import { renderMarkdown } from './sanitize-markdown';

interface PdfGoal {
    goalType: string;
    targetEventName: string | null;
    priority: number;
}

export interface PdfExportableReport {
    periodStart: string;
    periodEnd: string;
    summary: string;
    createdAt: string;
    goalContext: {
        notes: string | null;
        goals: PdfGoal[];
    };
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildReportPdfHtml(report: PdfExportableReport): string {
    // The summary is LLM-generated, so sanitize before embedding.
    const summaryHtml = renderMarkdown(report.summary);

    const parts: string[] = [
        `<h1>Weekly Training Report — ${report.periodStart} to ${report.periodEnd}</h1>`,
        `<p><em>Generated ${report.createdAt.slice(0, 10)} by GymCraft.</em></p>`,
    ];

    if (report.goalContext.goals.length > 0) {
        const items = report.goalContext.goals
            .map((goal) => {
                const name = goal.targetEventName ? ` — ${escapeHtml(goal.targetEventName)}` : '';
                return `<li>${escapeHtml(goal.goalType)}${name} (priority ${goal.priority})</li>`;
            })
            .join('');
        parts.push('<h2>Goals</h2>', `<ul>${items}</ul>`);
    }

    if (report.goalContext.notes) {
        parts.push('<h2>Notes</h2>', `<p>${escapeHtml(report.goalContext.notes)}</p>`);
    }

    parts.push('<hr>', summaryHtml);

    return `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.5;">${parts.join('\n')}</div>`;
}

// Mirrors DownloadAsPdf.svelte (gym plans): html2pdf.js is untyped and browser-only,
// so it's imported lazily at click time.
export async function downloadReportPdf(report: PdfExportableReport): Promise<void> {
    // @ts-expect-error html2pdf.js is not typed
    const { default: html2pdf } = await import('html2pdf.js');

    const container = document.createElement('div');
    container.innerHTML = buildReportPdfHtml(report);
    container.style.color = 'black';

    const opt = {
        margin: [20, 20],
        filename: `weekly-report-${report.periodStart}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    html2pdf().set(opt).from(container).save();
}
