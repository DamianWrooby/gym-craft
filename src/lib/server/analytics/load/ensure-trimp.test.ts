import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeTrimp } from './trimp';

const mocks = vi.hoisted(() => ({
    db: {
        activity: { update: vi.fn() },
        $transaction: vi.fn(async (ops: unknown[]) => ops),
    },
}));

vi.mock('$lib/database', () => ({ db: mocks.db }));

import { ensureTrimpLoads } from './ensure-trimp';

const noZones = {
    hrZone1Sec: null,
    hrZone2Sec: null,
    hrZone3Sec: null,
    hrZone4Sec: null,
    hrZone5Sec: null,
};

afterEach(() => {
    vi.clearAllMocks();
});

describe('ensureTrimpLoads', () => {
    it('computes and persists TRIMP for rows where trimpLoad is null', async () => {
        const rows = [{ id: 'a-1', durationSec: 1800, averageHr: 145, trimpLoad: null, ...noZones }];
        const profile = { restingHR: 50, maxHR: 190, sex: 'male' as const };

        const result = await ensureTrimpLoads(rows, profile);

        const expectedTrimp = computeTrimp({
            durationSec: 1800,
            hrZoneSeconds: null,
            averageHr: 145,
            restingHr: 50,
            maxHr: 190,
            sex: 'male',
        });
        expect(expectedTrimp).toBeGreaterThan(0);
        expect(result[0].trimpLoad).toBe(expectedTrimp);
        expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
        expect(mocks.db.activity.update).toHaveBeenCalledWith({
            where: { id: 'a-1' },
            data: { trimpLoad: expectedTrimp },
        });
    });

    it('leaves rows with an existing trimpLoad untouched and persists nothing', async () => {
        const rows = [{ id: 'a-1', durationSec: 1800, averageHr: 145, trimpLoad: 42, ...noZones }];

        const result = await ensureTrimpLoads(rows, { restingHR: 50, maxHR: 190, sex: 'male' });

        expect(result[0].trimpLoad).toBe(42);
        expect(mocks.db.$transaction).not.toHaveBeenCalled();
        expect(mocks.db.activity.update).not.toHaveBeenCalled();
    });

    it('falls back to a duration-based TRIMP when there is no HR data or profile', async () => {
        const rows = [{ id: 'a-1', durationSec: 1800, averageHr: null, trimpLoad: null, ...noZones }];

        const result = await ensureTrimpLoads(rows, { restingHR: null, maxHR: null, sex: null });

        expect(result[0].trimpLoad).toBe(60); // 30 min * 2
        expect(mocks.db.activity.update).toHaveBeenCalledWith({
            where: { id: 'a-1' },
            data: { trimpLoad: 60 },
        });
    });
});
