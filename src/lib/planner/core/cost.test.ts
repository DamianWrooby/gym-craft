import { describe, expect, it } from 'vitest';
import { costSession } from './cost';
import { getSchool } from '../schools/catalogue';
import type { RunBlock, TypedSession } from './session';

const daniels = getSchool('DANIELS');
const polarized = getSchool('POLARIZED');

const run = (steps: RunBlock[]): TypedSession => ({
    kind: 'RUNNING',
    scheduledDate: '2026-10-14',
    sequence: 0,
    body: { bodyVersion: 1, title: 'Run', keySession: null, reason: null, cutKey: null, steps },
});

describe('costSession', () => {
    it('costs a running session as minutes × the label weight', () => {
        // 10 min E (×2) + 20 min T (×4) + 10 min E (×2) = 20 + 80 + 20
        const s = run([
            { label: 'E', durationSec: 600 },
            { label: 'T', durationSec: 1200 },
            { label: 'E', durationSec: 600 },
        ]);
        expect(costSession(s, { school: daniels, paceSecPerKm: null })).toEqual({
            plannedLoad: 120,
            method: 'LABEL_TABLE',
        });
    });

    it('multiplies repeats and converts distance steps through the anchor pace', () => {
        // 6 × (800 m I at 4:00/km = 3.2 min ×5 = 16, + 2 min E ×2 = 4) = 120
        const s = run([
            {
                repeat: 6,
                steps: [
                    { label: 'I', distanceM: 800 },
                    { label: 'E', durationSec: 120 },
                ],
            },
        ]);
        expect(costSession(s, { school: daniels, paceSecPerKm: { I: 240, E: 330 } }).plannedLoad).toBeCloseTo(120);
    });

    it('uses the school table, so a polarized zone-3 minute costs 5', () => {
        expect(
            costSession(run([{ label: 'z3', durationSec: 600 }]), { school: polarized, paceSecPerKm: null }),
        ).toEqual({ plannedLoad: 50, method: 'LABEL_TABLE' });
    });

    it('cannot cost a distance step without a pace for its label', () => {
        expect(() =>
            costSession(run([{ label: 'I', distanceM: 800 }]), { school: daniels, paceSecPerKm: null }),
        ).toThrow(/pace/);
    });

    it('costs strength at the flat 2 TRIMP per minute', () => {
        const s: TypedSession = {
            kind: 'STRENGTH',
            scheduledDate: '2026-10-14',
            sequence: 1,
            body: {
                bodyVersion: 1,
                title: 'Lift',
                template: 'heavy-full-body',
                heavy: true,
                durationMin: 45,
                exercises: [],
            },
        };
        expect(costSession(s, { school: daniels, paceSecPerKm: null })).toEqual({
            plannedLoad: 90,
            method: 'DURATION',
        });
    });

    it.each([
        ['easy', 120],
        ['moderate', 180],
        ['hard', 240],
    ] as const)('costs an other session at the %s rate as an athlete estimate', (effort, load) => {
        const s: TypedSession = {
            kind: 'OTHER',
            scheduledDate: '2026-10-14',
            sequence: 0,
            body: { bodyVersion: 1, title: 'Ride', durationMin: 60, effort },
        };
        expect(costSession(s, { school: daniels, paceSecPerKm: null })).toEqual({
            plannedLoad: load,
            method: 'ATHLETE_ESTIMATE',
        });
    });
});
