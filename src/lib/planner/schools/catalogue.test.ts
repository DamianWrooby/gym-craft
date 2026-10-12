import { describe, expect, it } from 'vitest';
import { SCHOOLS, getSchool } from './catalogue';
import type { Marked } from './types';

function isMarked(v: unknown): v is Marked<unknown> {
    return !!v && typeof v === 'object' && 'mark' in v && 'value' in v;
}

/** Every number or boolean in a school definition must sit inside a Marked wrapper. */
function unmarkedPaths(node: unknown, path: string, out: string[]): string[] {
    if (isMarked(node)) {
        if (node.mark !== 'sourced' && node.mark !== 'judged') out.push(`${path}.mark`);
        return out;
    }
    if (typeof node === 'number' || typeof node === 'boolean') out.push(path);
    else if (Array.isArray(node)) node.forEach((v, i) => unmarkedPaths(v, `${path}[${i}]`, out));
    else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) unmarkedPaths(v, `${path}.${k}`, out);
    }
    return out;
}

describe.each(SCHOOLS.map((s) => [s.id, s] as const))('school catalogue: %s', (id, school) => {
    it('is found by id', () => {
        expect(getSchool(id)).toBe(school);
    });

    it('marks every value sourced or judged', () => {
        expect(unmarkedPaths(school, id, [])).toEqual([]);
    });

    it('gives every intensity label a weight between 1 and 5 and a target type', () => {
        expect(school.intensityLabels.length).toBeGreaterThan(0);
        for (const label of school.intensityLabels) {
            expect(label.edwardsWeight.value).toBeGreaterThanOrEqual(1);
            expect(label.edwardsWeight.value).toBeLessThanOrEqual(5);
            expect(['PACE', 'HR']).toContain(label.targetType.value);
            if (label.targetType.value === 'PACE') expect(label.paceDerivation).toBeTruthy();
        }
    });

    it('declares key sessions with reasons and a cut order', () => {
        expect(school.keySessions.length).toBeGreaterThan(0);
        for (const k of school.keySessions) expect(k.reason).toBeTruthy();
        expect(school.cutOrder.value.length).toBeGreaterThan(0);
        const keys = new Set(school.keySessions.map((k) => k.key));
        for (const c of school.cutOrder.value) expect(keys.has(c)).toBe(false);
    });

    it('has floors that fit the school floor and the ideal length', () => {
        let mandatoryFloors = 0;
        let ideal = 0;
        for (const p of school.phases) {
            expect(p.floorWeeks.value).toBeGreaterThanOrEqual(1);
            expect(p.floorWeeks.value).toBeLessThanOrEqual(p.idealWeeks.value);
            if (!p.droppable.value) mandatoryFloors += p.floorWeeks.value;
            ideal += p.idealWeeks.value;
        }
        expect(mandatoryFloors).toBeLessThanOrEqual(school.schoolFloorWeeks.value);
        expect(school.schoolFloorWeeks.value).toBeLessThanOrEqual(ideal);
        expect(school.taperFractions.value.length).toBeLessThanOrEqual(school.schoolFloorWeeks.value);
    });

    it('names only its own phases in compression and drop order', () => {
        const keys = school.phases.map((p) => p.key);
        for (const k of school.compressionOrder.value) expect(keys).toContain(k);
        for (const k of school.dropOrder.value) {
            expect(school.phases.find((p) => p.key === k)?.droppable.value).toBe(true);
        }
    });

    it('has phase intents and loss lines, and strength templates tagged heavy or light', () => {
        for (const p of school.phases) {
            expect(p.intent).toBeTruthy();
            expect(p.lossLine).toBeTruthy();
        }
        expect(school.strengthTemplates.some((t) => t.tag === 'heavy')).toBe(true);
        expect(school.strengthTemplates.some((t) => t.tag === 'light')).toBe(true);
    });
});
