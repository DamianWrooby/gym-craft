import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    aiUsageUpsert: vi.fn(),
    trainingReportUpsert: vi.fn(),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
        return await fn({
            aiUsage: { upsert: mocks.aiUsageUpsert },
            trainingReport: { upsert: mocks.trainingReportUpsert },
        });
    }),
}));

vi.mock('$lib/database', () => ({
    db: {
        $transaction: mocks.transaction,
        aiUsage: { upsert: mocks.aiUsageUpsert },
        trainingReport: { upsert: mocks.trainingReportUpsert },
        athleteProfile: { findUnique: vi.fn(), upsert: vi.fn() },
        runningGoal: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
        plan: { create: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
        verificationToken: { findFirst: vi.fn(), update: vi.fn() },
        garminData: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        configuration: { findFirst: vi.fn() },
        user: { findUnique: vi.fn() },
    },
}));

import { persistTrainingReport } from './prisma';

const baseInput = {
    userId: 'user-1',
    type: 'WEEKLY' as const,
    periodStart: '2026-05-04',
    periodEnd: '2026-05-10',
    metrics: { foo: 'bar' },
    summary: 'Great week',
    goalContext: { notes: 'test' },
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'));
});

afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
});

describe('persistTrainingReport', () => {
    it('upserts AiUsage for the current calendar month with kind=weekly_report', async () => {
        mocks.aiUsageUpsert.mockResolvedValueOnce({ count: 1 });
        mocks.trainingReportUpsert.mockResolvedValueOnce({ id: 'report-1' });

        await persistTrainingReport(baseInput);

        expect(mocks.aiUsageUpsert).toHaveBeenCalledWith({
            where: { userId_kind_day: { userId: 'user-1', kind: 'weekly_report', day: '2026-05-01' } },
            create: { userId: 'user-1', kind: 'weekly_report', day: '2026-05-01', count: 1 },
            update: { count: { increment: 1 } },
        });
    });

    it('returns the persisted report row from the trainingReport upsert', async () => {
        mocks.aiUsageUpsert.mockResolvedValueOnce({ count: 1 });
        mocks.trainingReportUpsert.mockResolvedValueOnce({ id: 'report-1' });

        const result = await persistTrainingReport(baseInput);

        expect(result).toEqual({ id: 'report-1' });
        expect(mocks.trainingReportUpsert).toHaveBeenCalledTimes(1);
    });

    it('skips the AiUsage upsert when consumeSlot is false (empty-week path)', async () => {
        mocks.trainingReportUpsert.mockResolvedValueOnce({ id: 'empty-report' });

        const result = await persistTrainingReport(baseInput, { consumeSlot: false });

        expect(mocks.aiUsageUpsert).not.toHaveBeenCalled();
        expect(mocks.trainingReportUpsert).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ id: 'empty-report' });
    });

    it('passes the full payload to the trainingReport upsert (create and update branches)', async () => {
        mocks.aiUsageUpsert.mockResolvedValueOnce({ count: 1 });
        mocks.trainingReportUpsert.mockResolvedValueOnce({ id: 'report-1' });

        await persistTrainingReport(baseInput);

        expect(mocks.trainingReportUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId_type_periodStart: { userId: 'user-1', type: 'WEEKLY', periodStart: '2026-05-04' } },
                create: expect.objectContaining({
                    userId: 'user-1',
                    type: 'WEEKLY',
                    summary: 'Great week',
                }),
                update: expect.objectContaining({
                    userId: 'user-1',
                    type: 'WEEKLY',
                    summary: 'Great week',
                    createdAt: expect.any(Date),
                }),
            }),
        );
    });
});
