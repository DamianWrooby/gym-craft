import { describe, expect, it } from 'vitest';
import { attachTargets, labelPaces } from './targets';
import { getSchool } from '../schools/catalogue';
import { zonesFromMaxHr } from './zones';
import type { TypedSession } from './session';

const daniels = getSchool('DANIELS');
const polarized = getSchool('POLARIZED');
// A 20:00 5 km is VDOT ≈ 49.8.
const anchor = { distanceM: 5000, timeSec: 1200 };

describe('labelPaces', () => {
    it('derives Daniels paces from the anchor, slowest for Easy and fastest for Repetition', () => {
        const paces = labelPaces(daniels, anchor)!;
        // Daniels tables for VDOT 50: T ≈ 4:15/km, I ≈ 3:55/km.
        expect(paces.T).toBeGreaterThan(245);
        expect(paces.T).toBeLessThan(265);
        expect(paces.I).toBeGreaterThan(228);
        expect(paces.I).toBeLessThan(245);
        expect(paces.E).toBeGreaterThan(paces.M);
        expect(paces.M).toBeGreaterThan(paces.T);
        expect(paces.R).toBeLessThan(paces.I);
    });

    it('gives no paces without an anchor, and none for a heart-rate school', () => {
        expect(labelPaces(daniels, null)).toBeNull();
        expect(labelPaces(polarized, anchor)).toBeNull();
    });
});

describe('attachTargets', () => {
    const run = (label: string): TypedSession => ({
        kind: 'RUNNING',
        scheduledDate: '2026-10-20',
        sequence: 0,
        body: {
            bodyVersion: 1,
            title: 'Run',
            keySession: null,
            reason: null,
            cutKey: null,
            steps: [{ label, durationSec: 600 }],
        },
    });

    it('puts an HR target from the athlete zones on a heart-rate label', () => {
        const zones = zonesFromMaxHr(200); // z4 161–180, z5 181–200
        const [s] = attachTargets([run('z3')], { school: polarized, anchor: null, zones });
        expect(s.kind === 'RUNNING' && s.body.steps[0]).toMatchObject({
            target: { type: 'HR', lowerBpm: 161, upperBpm: 200 },
        });
    });

    it('puts a pace range on a pace label, and nothing when there is no anchor', () => {
        const zones = zonesFromMaxHr(200);
        const [withAnchor] = attachTargets([run('T')], { school: daniels, anchor, zones });
        expect(withAnchor.kind === 'RUNNING' && withAnchor.body.steps[0]).toMatchObject({ target: { type: 'PACE' } });
        const [without] = attachTargets([run('T')], { school: daniels, anchor: null, zones });
        expect(without.kind === 'RUNNING' && 'target' in without.body.steps[0]).toBe(false);
    });
});
