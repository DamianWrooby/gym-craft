import { describe, expect, it } from 'vitest';
import { formatReportPeriod, reportSummaryPreview } from './report-format';

describe('formatReportPeriod', () => {
    it('formats a Mon–Sun period as short month/day in UTC', () => {
        expect(formatReportPeriod('2026-06-01', '2026-06-07')).toBe('Jun 1 – Jun 7');
    });
});

describe('reportSummaryPreview', () => {
    it('strips markdown markers and trims', () => {
        expect(reportSummaryPreview('## Solid **base** week')).toBe('Solid base week');
    });

    it('truncates long text with an ellipsis', () => {
        const long = 'a'.repeat(200);
        const result = reportSummaryPreview(long, 140);
        expect(result.endsWith('…')).toBe(true);
        expect(result.length).toBe(141);
    });
});
