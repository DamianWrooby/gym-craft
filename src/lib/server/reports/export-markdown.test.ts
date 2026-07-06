import { describe, expect, it } from 'vitest';
import { buildReportMarkdown } from './export-markdown';

const report = {
    periodStart: '2026-06-29',
    periodEnd: '2026-07-05',
    summary: '## Coach review\n\nSolid week.',
    createdAt: new Date('2026-07-06T10:00:00Z'),
    goalContext: {
        notes: 'Felt tired on Thursday',
        goals: [{ goalType: 'RACE', targetEventName: 'City Half', priority: 1 }],
    },
};

describe('buildReportMarkdown', () => {
    it('renders a titled document with period, goals, notes, and the summary', () => {
        const md = buildReportMarkdown(report);
        expect(md).toContain('# Weekly Training Report — 2026-06-29 to 2026-07-05');
        expect(md).toContain('RACE — City Half');
        expect(md).toContain('Felt tired on Thursday');
        expect(md).toContain('## Coach review');
        expect(md).toContain('Solid week.');
    });

    it('omits the goals and notes sections when absent', () => {
        const md = buildReportMarkdown({ ...report, goalContext: { notes: null, goals: [] } });
        expect(md).not.toContain('## Goals');
        expect(md).not.toContain('## Notes');
    });
});
