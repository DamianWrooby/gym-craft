import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    updateMany: vi.fn(),
    upsert: vi.fn(),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
        return await fn({
            user: { updateMany: mocks.updateMany },
            trainingReport: { upsert: mocks.upsert },
        });
    }),
}));

vi.mock('$lib/database', () => ({
    db: {
        $transaction: mocks.transaction,
        user: { updateMany: mocks.updateMany },
        trainingReport: { upsert: mocks.upsert },
        athleteProfile: { findUnique: vi.fn(), upsert: vi.fn() },
        runningGoal: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
        plan: { create: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
        verificationToken: { findFirst: vi.fn(), update: vi.fn() },
        garminData: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        configuration: { findFirst: vi.fn() },
    },
}));

import { persistTrainingReport, ReportLimitReachedError } from './prisma';

const baseInput = {
    userId: 'user-1',
    type: 'WEEKLY' as const,
    periodStart: '2026-05-04',
    periodEnd: '2026-05-10',
    metrics: { foo: 'bar' },
    summary: 'Great week',
    goalContext: { notes: 'test' },
};

afterEach(() => {
    vi.clearAllMocks();
});

describe('persistTrainingReport', () => {
    it('uses an atomic conditional updateMany scoped by reportGenerationCount < cap', async () => {
        mocks.updateMany.mockResolvedValueOnce({ count: 1 });
        mocks.upsert.mockResolvedValueOnce({ id: 'report-1' });

        await persistTrainingReport(baseInput, 3);

        expect(mocks.updateMany).toHaveBeenCalledWith({
            where: { id: 'user-1', reportGenerationCount: { lt: 3 } },
            data: { reportGenerationCount: { increment: 1 } },
        });
    });

    it('upserts the report only after a successful counter bump', async () => {
        mocks.updateMany.mockResolvedValueOnce({ count: 1 });
        mocks.upsert.mockResolvedValueOnce({ id: 'report-1' });

        const result = await persistTrainingReport(baseInput, 3);

        expect(result).toEqual({ id: 'report-1' });
        expect(mocks.upsert).toHaveBeenCalledTimes(1);
    });

    it('throws ReportLimitReachedError when the conditional update affects zero rows', async () => {
        mocks.updateMany.mockResolvedValueOnce({ count: 0 });

        await expect(persistTrainingReport(baseInput, 3)).rejects.toBeInstanceOf(ReportLimitReachedError);
        expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it('skips the counter update entirely when consumeSlot is false (empty-week path)', async () => {
        mocks.upsert.mockResolvedValueOnce({ id: 'empty-report' });

        const result = await persistTrainingReport(baseInput, 3, { consumeSlot: false });

        expect(mocks.updateMany).not.toHaveBeenCalled();
        expect(mocks.upsert).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ id: 'empty-report' });
    });

    it('serialises two parallel callers — the loser sees ReportLimitReachedError (race protection)', async () => {
        // Simulate the postgres conditional update behavior:
        // First caller bumps count from 2 → 3 (count: 1 returned).
        // Second caller's WHERE clause now fails (count: 0 returned).
        let increments = 0;
        mocks.updateMany.mockImplementation(async () => {
            const currentCount = increments;
            if (currentCount < 3) {
                increments += 1;
                return { count: 1 };
            }
            return { count: 0 };
        });
        mocks.upsert.mockImplementation(async () => ({ id: `report-${increments}` }));

        // Pre-bump counter twice (simulating 2 reports already generated)
        increments = 2;

        const results = await Promise.allSettled([
            persistTrainingReport(baseInput, 3),
            persistTrainingReport({ ...baseInput, periodStart: '2026-05-11', periodEnd: '2026-05-17' }, 3),
        ]);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        const rejection = rejected[0] as PromiseRejectedResult;
        expect(rejection.reason).toBeInstanceOf(ReportLimitReachedError);
    });

    it('passes the full payload to upsert (whether new or overwrite)', async () => {
        mocks.updateMany.mockResolvedValueOnce({ count: 1 });
        mocks.upsert.mockResolvedValueOnce({ id: 'report-1' });

        await persistTrainingReport(baseInput, 3);

        expect(mocks.upsert).toHaveBeenCalledWith(
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
