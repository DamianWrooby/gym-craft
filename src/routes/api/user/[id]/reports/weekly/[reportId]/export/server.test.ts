import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getReportById: vi.fn(),
}));

vi.mock('$lib/prisma/prisma', () => ({
    getReportById: mocks.getReportById,
}));

import { GET } from './+server';

const params = { id: 'user-1', reportId: 'report-1' };

function makeLocals(tier: 'FREE' | 'SUPPORTER', userId = 'user-1') {
    return { user: { id: userId, subscriptionTier: tier } } as unknown as App.Locals;
}

const reportRow = {
    id: 'report-1',
    userId: 'user-1',
    periodStart: '2026-06-29',
    periodEnd: '2026-07-05',
    summary: 'Solid week.',
    createdAt: new Date('2026-07-06T10:00:00Z'),
    goalContext: { notes: null, goals: [] },
};

beforeEach(() => {
    mocks.getReportById.mockResolvedValue(reportRow);
});

afterEach(() => vi.clearAllMocks());

describe('GET .../reports/weekly/[reportId]/export', () => {
    it('rejects a mismatched user', async () => {
        const res = await GET({ params, locals: makeLocals('SUPPORTER', 'other') } as never);
        expect(res.status).toBe(403);
    });

    it('rejects FREE users with UPGRADE_REQUIRED', async () => {
        const res = await GET({ params, locals: makeLocals('FREE') } as never);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.code).toBe('UPGRADE_REQUIRED');
    });

    it('404s when the report does not exist', async () => {
        mocks.getReportById.mockResolvedValue(null);
        const res = await GET({ params, locals: makeLocals('SUPPORTER') } as never);
        expect(res.status).toBe(404);
    });

    it('returns a markdown attachment for supporters', async () => {
        const res = await GET({ params, locals: makeLocals('SUPPORTER') } as never);
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toContain('text/markdown');
        expect(res.headers.get('Content-Disposition')).toContain('weekly-report-2026-06-29.md');
        const body = await res.text();
        expect(body).toContain('# Weekly Training Report — 2026-06-29 to 2026-07-05');
        expect(body).toContain('Solid week.');
    });
});
