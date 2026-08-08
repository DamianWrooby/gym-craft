import { describe, expect, it } from 'vitest';
import { computeTrimp } from './trimp';
import { fillTrimpLoads } from './fill-trimp';

const noZones = {
    hrZone1Sec: null,
    hrZone2Sec: null,
    hrZone3Sec: null,
    hrZone4Sec: null,
    hrZone5Sec: null,
};

describe('fillTrimpLoads', () => {
    it('computes TRIMP for rows where trimpLoad is null', () => {
        const rows = [{ id: 'a-1', durationSec: 1800, averageHr: 145, trimpLoad: null, ...noZones }];
        const profile = { restingHR: 50, maxHR: 190, sex: 'male' as const };

        const result = fillTrimpLoads(rows, profile);

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
    });

    it('leaves rows with an existing trimpLoad untouched', () => {
        const rows = [{ id: 'a-1', durationSec: 1800, averageHr: 145, trimpLoad: 42, ...noZones }];

        const result = fillTrimpLoads(rows, { restingHR: 50, maxHR: 190, sex: 'male' });

        expect(result[0].trimpLoad).toBe(42);
    });

    it('falls back to a duration-based TRIMP when there is no HR data or profile', () => {
        const rows = [{ id: 'a-1', durationSec: 1800, averageHr: null, trimpLoad: null, ...noZones }];

        const result = fillTrimpLoads(rows, { restingHR: null, maxHR: null, sex: null });

        expect(result[0].trimpLoad).toBe(60); // 30 min * 2
    });

    it('prefers Edwards zone-based TRIMP over the averageHr fallback', () => {
        const rows = [
            {
                id: 'a-1',
                durationSec: 1800,
                averageHr: 145,
                trimpLoad: null,
                hrZone1Sec: 600,
                hrZone2Sec: 600,
                hrZone3Sec: 600,
                hrZone4Sec: 0,
                hrZone5Sec: 0,
            },
        ];

        const result = fillTrimpLoads(rows, { restingHR: 50, maxHR: 190, sex: 'male' });

        // (10min * 1) + (10min * 2) + (10min * 3)
        expect(result[0].trimpLoad).toBe(60);
    });

    it('does not mutate the input rows', () => {
        const rows = [{ id: 'a-1', durationSec: 1800, averageHr: 145, trimpLoad: null, ...noZones }];

        fillTrimpLoads(rows, { restingHR: 50, maxHR: 190, sex: 'male' });

        expect(rows[0].trimpLoad).toBeNull();
    });
});
