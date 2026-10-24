import { describe, expect, it } from 'vitest';
import { addDays } from '$lib/utils/iso-week';
import { getSchool } from '../schools/catalogue';
import { layoutHorizon, type Layout, type LayoutInput } from './layout';
import { recut, type RecutInput, type StoredPhase, type StoredWeek } from './recut';

const MONDAY = '2026-10-12';
const endForWeeks = (n: number, from = MONDAY) => addDays(from, 7 * n - 1);

const context = {
    goal: { isRace: true, distanceM: 21097 },
    recentVolume: { minutesPerWeek: 200, metresPerWeek: 40000 },
    runsPerWeek: 4,
    anchorPresent: true,
};

function layout(overrides: Partial<LayoutInput> = {}): Layout {
    const result = layoutHorizon({
        school: getSchool('POLARIZED'),
        startDate: MONDAY,
        endDate: endForWeeks(20),
        ...context,
        ...overrides,
    });
    if (!result.ok) throw new Error(`refused: ${result.reason}`);
    return result.layout;
}

/** A stored plan from a layout: the first `written` weeks generated, the rest not yet pulled. */
function stored(l: Layout, written: number): { phases: StoredPhase[]; weeks: StoredWeek[] } {
    return {
        phases: l.phases,
        weeks: l.weeks.map(({ index, ...w }) => ({
            ...w,
            generation: index < written ? 'GENERATED' : 'PENDING',
            pulled: index < written,
            timeTrialDistanceM: null,
        })),
    };
}

function input(l: Layout, written: number, change: RecutInput['change'], overrides: Partial<RecutInput> = {}) {
    return {
        today: addDays(MONDAY, 2),
        endDate: l.weeks[l.weeks.length - 1].endDate,
        ...stored(l, written),
        change,
        ...context,
        ...overrides,
    } satisfies RecutInput;
}

const twentyWeeks = layout();
const phaseWeeks = (phases: { name: string; weekCount: number }[]) => phases.map((p) => [p.name, p.weekCount]);

describe('recut: refusals', () => {
    it.each([
        ['nothing changes', {}, 'Nothing to change'],
        ['the goal date falls inside a written week', { endDate: endForWeeks(2) }, 'already written'],
        ['the goal date is today or earlier', { endDate: MONDAY }, 'after today'],
    ])('refuses when %s', (_, change, reason) => {
        const result = recut(input(twentyWeeks, 2, change));
        expect(result.kind).toBe('refused');
        if (result.kind === 'refused') expect(result.reason).toContain(reason);
    });

    it('refuses a layout the floors cannot hold', () => {
        const nine = layout({ endDate: endForWeeks(9) });
        const result = recut(input(nine, 1, { endDate: endForWeeks(8) }));
        expect(result).toMatchObject({ kind: 'refused' });
    });
});

describe('recut: school change', () => {
    it('re-lays every week after the written ones under the new school', () => {
        const result = recut(input(twentyWeeks, 2, { schoolId: 'DANIELS' }));
        expect(result.kind).toBe('relaid');
        if (result.kind !== 'relaid') return;
        expect(result.relayFrom).toBe(addDays(MONDAY, 14));
        expect(result.weeks).toHaveLength(18);
        expect(result.weeks[0].startDate).toBe(addDays(MONDAY, 14));
        expect(result.phases.every((p) => p.school === 'DANIELS')).toBe(true);
        expect(result.summary).toBe('Weeks 3–20 will be re-laid under Daniels.');
    });

    it('keeps a pulled week that is not generated yet', () => {
        const s = stored(twentyWeeks, 1);
        s.weeks[1] = { ...s.weeks[1], pulled: true };
        const result = recut({ ...input(twentyWeeks, 1, { schoolId: 'DANIELS' }), ...s });
        expect(result.kind === 'relaid' && result.relayFrom).toBe(addDays(MONDAY, 14));
    });
});

describe('recut: goal date', () => {
    it('absorbs a race moved earlier inside its last week', () => {
        const result = recut(input(twentyWeeks, 2, { endDate: addDays(endForWeeks(20), -5) }));
        expect(result.kind).toBe('absorbed');
        if (result.kind !== 'absorbed') return;
        expect(result.weeks).toHaveLength(18);
        expect(result.weeks[17].inHorizonDays).toBe(2);
        expect(result.weeks[17].volumeTarget).toBeLessThan(twentyWeeks.weeks[19].volumeTarget);
    });

    it('absorbs a race 7 days earlier by shortening a phase not underway, never the taper', () => {
        const result = recut(input(twentyWeeks, 2, { endDate: endForWeeks(19) }));
        expect(result.kind).toBe('absorbed');
        if (result.kind !== 'absorbed') return;
        // Weeks 1–2 sit in the lead-in, so the lead-in is underway: the aerobic phase gives the week.
        expect(phaseWeeks(twentyWeeks.phases)).toEqual([
            ['Lead-in (GymCraft)', 4],
            ['Aerobic', 14],
            ['Taper', 2],
        ]);
        expect(phaseWeeks(result.phases)).toEqual([
            ['Lead-in (GymCraft)', 2],
            ['Aerobic', 13],
            ['Taper', 2],
        ]);
        expect(result.weeks.filter((w) => w.isTaper)).toHaveLength(2);
        expect(result.weeks.filter((w) => w.isCutback)).toHaveLength(
            twentyWeeks.weeks.slice(2).filter((w) => w.isCutback).length,
        );
        expect(result.weeks[result.weeks.length - 1].endDate).toBe(endForWeeks(19));
    });

    it('takes the week from a lead-in that is not underway first', () => {
        // A kept week of an earlier phase, then a fresh lead-in after it (as a past recut leaves it).
        const tail = layout({ startDate: addDays(MONDAY, 7), endDate: endForWeeks(20) });
        const s = stored(tail, 0);
        const kept: StoredWeek = { ...s.weeks[0], startDate: MONDAY, endDate: addDays(MONDAY, 6) };
        const phases: StoredPhase[] = [
            { ...s.phases[1], ordinal: 0, startDate: MONDAY, endDate: addDays(MONDAY, 6) },
            ...s.phases.map((p) => ({ ...p, ordinal: p.ordinal + 1 })),
        ];
        const weeks: StoredWeek[] = [
            { ...kept, phaseOrdinal: 0, generation: 'GENERATED', pulled: true, isCutback: false },
            ...s.weeks.map((w) => ({ ...w, phaseOrdinal: w.phaseOrdinal + 1 })),
        ];
        const result = recut({ ...input(tail, 0, { endDate: endForWeeks(19) }), phases, weeks });
        expect(result.kind).toBe('absorbed');
        if (result.kind !== 'absorbed') return;
        expect(result.phases[0]).toMatchObject({ name: 'Lead-in (GymCraft)' });
        expect(result.phases[0].weekCount).toBe(tail.phases[0].weekCount - 1);
    });

    it('asks, through a full re-lay, for a race more than 7 days earlier', () => {
        const result = recut(input(twentyWeeks, 2, { endDate: addDays(endForWeeks(19), -1) }));
        expect(result).toMatchObject({ kind: 'relaid', summary: 'Weeks 3–19 will be re-laid under Polarized 80/20.' });
    });

    it('asks, through a full re-lay, when absorbing would breach a floor', () => {
        const eleven = layout({ endDate: endForWeeks(11) });
        // Aerobic 9 + taper 2, week 1 written: aerobic is underway, nothing else may give.
        const result = recut(input(eleven, 1, { endDate: endForWeeks(10) }));
        expect(result.kind).toBe('relaid');
    });

    it('asks, through a full re-lay, for a later race', () => {
        const result = recut(input(twentyWeeks, 2, { endDate: endForWeeks(22) }));
        expect(result).toMatchObject({ kind: 'relaid' });
        if (result.kind === 'relaid') expect(result.weeks).toHaveLength(20);
    });
});
