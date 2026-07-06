import { describe, expect, it } from 'vitest';
import { buildReportPdfHtml } from './report-pdf';

const report = {
    periodStart: '2026-06-29',
    periodEnd: '2026-07-05',
    summary: '## Coach review\n\nSolid week with **good** consistency.',
    createdAt: '2026-07-06T10:00:00.000Z',
    goalContext: {
        notes: 'Felt tired on Thursday',
        goals: [{ goalType: 'RACE', targetEventName: 'City Half', priority: 1 }],
    },
};

describe('buildReportPdfHtml', () => {
    it('renders a titled document with period, goals, notes, and the summary as HTML', () => {
        const html = buildReportPdfHtml(report);
        expect(html).toContain('Weekly Training Report');
        expect(html).toContain('2026-06-29');
        expect(html).toContain('2026-07-05');
        expect(html).toContain('RACE — City Half');
        expect(html).toContain('Felt tired on Thursday');
        expect(html).toContain('<h2>Coach review</h2>');
        expect(html).toContain('<strong>good</strong>');
    });

    it('omits the goals and notes sections when absent', () => {
        const html = buildReportPdfHtml({ ...report, goalContext: { notes: null, goals: [] } });
        expect(html).not.toContain('Goals');
        expect(html).not.toContain('Notes');
    });

    it('sanitizes script injection in the summary', () => {
        const html = buildReportPdfHtml({ ...report, summary: 'Nice <script>alert(1)</script> week' });
        expect(html).not.toContain('<script>');
    });
});
