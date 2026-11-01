import { describe, expect, it } from 'vitest';
import { addDays, isMonday } from '$lib/utils/iso-week';
import { getSchool } from '../schools/catalogue';
import { judged, sourced, type SchoolDefinition } from '../schools/types';
import { defaultCompression, layoutHorizon, type GymLevel, type LayoutInput, type Layout } from './layout';

const MONDAY = '2026-10-12';
const polarized = getSchool('POLARIZED');
const daniels = getSchool('DANIELS');

/** End date (a Sunday) for a horizon of `n` whole weeks starting on MONDAY. */
const endForWeeks = (n: number) => addDays(MONDAY, 7 * n - 1);

function input(overrides: Partial<LayoutInput> = {}): LayoutInput {
    return {
        school: polarized,
        startDate: MONDAY,
        endDate: endForWeeks(16),
        goal: { isRace: true, distanceM: 21097 },
        recentVolume: { minutesPerWeek: 200, metresPerWeek: 40000 },
        runsPerWeek: 4,
        anchorPresent: true,
        ...overrides,
    };
}

function layout(overrides: Partial<LayoutInput> = {}): Layout {
    const result = layoutHorizon(input(overrides));
    if (!result.ok) throw new Error(`refused: ${result.reason}`);
    return result.layout;
}

const phaseWeeks = (l: Layout) => l.phases.map((p) => [p.name, p.weekCount]);

describe('layoutHorizon: lead-in bands', () => {
    it.each([
        [
            16,
            'none',
            [
                ['Aerobic', 14],
                ['Taper', 2],
            ],
        ],
        [
            17,
            'bridge',
            [
                ['Lead-in (GymCraft)', 1],
                ['Aerobic', 14],
                ['Taper', 2],
            ],
        ],
        [
            18,
            'bridge',
            [
                ['Lead-in (GymCraft)', 2],
                ['Aerobic', 14],
                ['Taper', 2],
            ],
        ],
        [
            19,
            'lead-in',
            [
                ['Lead-in (GymCraft)', 3],
                ['Aerobic', 14],
                ['Taper', 2],
            ],
        ],
        [
            30,
            'lead-in',
            [
                ['Lead-in (GymCraft)', 14],
                ['Aerobic', 14],
                ['Taper', 2],
            ],
        ],
    ])('%i weeks → %s', (weeks, leadIn, phases) => {
        const l = layout({ endDate: endForWeeks(weeks) });
        expect(l.leadIn).toBe(leadIn);
        expect(phaseWeeks(l)).toEqual(phases);
        expect(l.weeks).toHaveLength(weeks);
    });

    it('caps a lead-in before a distance school at its start volume when there is no running history', () => {
        // Daniels start without history: 0.5 × 64 360 m = 32 180 m ≈ 209 min at the judged easy pace.
        const l = layout({
            school: daniels,
            endDate: endForWeeks(40),
            recentVolume: { minutesPerWeek: 0, metresPerWeek: 0 },
        });
        const leadIn = l.weeks.filter((w) => w.phaseOrdinal === 0);
        expect(leadIn.length).toBeGreaterThan(10);
        expect(Math.max(...leadIn.map((w) => w.volumeTarget))).toBe(210);
    });

    it("labels the lead-in as GymCraft's and shaped to fit the school", () => {
        const lead = layout({ endDate: endForWeeks(20) }).phases[0];
        expect(lead).toMatchObject({ source: 'LEAD_IN', volumeUnit: 'MINUTES' });
        expect(lead.intent).toContain('shaped to fit Polarized 80/20');
    });

    it('holds a bridge at recent volume with no cutback', () => {
        const l = layout({ endDate: endForWeeks(18) });
        expect(l.weeks.slice(0, 2).map((w) => [w.volumeTarget, w.isCutback])).toEqual([
            [200, false],
            [200, false],
        ]);
    });

    it('ramps a lead-in by 10 % a week with a cutback every 4th week, stopping at the school start', () => {
        // Polarized start for 100 min recent volume: max(100, 0.75 × 180) = 135 min.
        const l = layout({ endDate: endForWeeks(24), recentVolume: { minutesPerWeek: 100, metresPerWeek: 0 } });
        expect(l.weeks.slice(0, 8).map((w) => [w.volumeTarget, w.isCutback])).toEqual([
            [100, false],
            [110, false],
            [120, false],
            [95, true],
            [135, false],
            [135, false],
            [135, false],
            [110, true],
        ]);
    });
});

describe('layoutHorizon: compression and refusal', () => {
    it('shortens the polarized aerobic phase and names the loss', () => {
        const l = layout({ endDate: endForWeeks(12) });
        expect(phaseWeeks(l)).toEqual([
            ['Aerobic', 10],
            ['Taper', 2],
        ]);
        expect(l.losses).toEqual([expect.stringContaining('Aerobic shortened from 14 to 10 weeks')]);
    });

    it('drops Daniels Early Quality first when the floors do not fit', () => {
        expect(defaultCompression(daniels, 10)).toEqual({
            eq: 0,
            tq: 4,
            fq: 6,
        });
        const l = layout({ school: daniels, endDate: endForWeeks(10) });
        expect(phaseWeeks(l)).toEqual([
            ['Transition Quality', 4],
            ['Final Quality', 6],
        ]);
        expect(l.losses).toEqual([
            expect.stringContaining('Early Quality dropped'),
            expect.stringContaining('Transition Quality shortened from 6 to 4 weeks'),
        ]);
    });

    it("follows the athlete's compression choice and puts spare weeks into the lead-in", () => {
        const l = layout({ school: daniels, endDate: endForWeeks(16), compression: { eq: 4, tq: 4, fq: 4 } });
        expect(phaseWeeks(l)).toEqual([
            ['Lead-in (GymCraft)', 4],
            ['Early Quality', 4],
            ['Transition Quality', 4],
            ['Final Quality', 4],
        ]);
    });

    it.each([
        ['horizon below the school floor', { endDate: endForWeeks(8) }, 'needs at least 9 weeks'],
        ['end before start', { endDate: addDays(MONDAY, -1) }, 'must end after'],
        [
            'phase below its floor',
            { endDate: endForWeeks(12), compression: { aerobic: 6, taper: 2 } },
            'at least 7 weeks',
        ],
        ['dropping a phase that is not droppable', { compression: { aerobic: 14, taper: 0 } }, 'cannot be dropped'],
        [
            'choices longer than the horizon',
            { endDate: endForWeeks(12), compression: { aerobic: 14, taper: 2 } },
            'longer than the horizon',
        ],
        [
            'school weeks under the school floor',
            { school: daniels, endDate: endForWeeks(10), compression: { eq: 0, tq: 0, fq: 4 } },
            'at least 8 weeks',
        ],
    ])('refuses: %s', (_, overrides, reason) => {
        const result = layoutHorizon(input(overrides as Partial<LayoutInput>));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toContain(reason);
    });
});

describe('layoutHorizon: Daniels Foundation is auto-satisfied', () => {
    it('adds Foundation for an athlete who is not running and has no lead-in room', () => {
        const l = layout({
            school: daniels,
            endDate: endForWeeks(22),
            recentVolume: { minutesPerWeek: 0, metresPerWeek: 0 },
        });
        expect(phaseWeeks(l)).toEqual([
            ['Foundation', 4],
            ['Early Quality', 6],
            ['Transition Quality', 6],
            ['Final Quality', 6],
        ]);
    });

    it('leaves Foundation out for an athlete who already runs', () => {
        const l = layout({ school: daniels, endDate: endForWeeks(22) });
        expect(l.phases[0].name).toBe('Lead-in (GymCraft)');
        expect(l.phases.some((p) => p.name === 'Foundation')).toBe(false);
    });
});

describe('layoutHorizon: cutbacks', () => {
    const cutbackIndexes = (l: Layout) => l.weeks.filter((w) => w.isCutback).map((w) => w.index);

    it('applies the 3-week cap where the school cadence is judged', () => {
        expect(cutbackIndexes(layout())).toEqual([3, 7, 11]);
    });

    it('applies the cap where the school places no cutback', () => {
        expect(cutbackIndexes(layout({ school: daniels, endDate: endForWeeks(18) }))).toEqual([3, 7, 11, 15]);
    });

    it('counts across the lead-in and phase boundaries, ignoring bridge weeks', () => {
        expect(cutbackIndexes(layout({ endDate: endForWeeks(18) }))).toEqual([5, 9, 13]);
        expect(cutbackIndexes(layout({ endDate: endForWeeks(21) }))).toEqual([3, 7, 11, 15]);
    });

    it('follows a sourced school cadence past the cap', () => {
        const fiveWeek: SchoolDefinition = { ...polarized, cutbackCadence: sourced(5, 'test fixture') };
        expect(cutbackIndexes(layout({ school: fiveWeek }))).toEqual([5, 11]);
    });

    it('still caps a judged cadence looser than 3', () => {
        const loose: SchoolDefinition = { ...polarized, cutbackCadence: judged(5) };
        expect(cutbackIndexes(layout({ school: loose }))).toEqual([3, 7, 11]);
    });

    it('cuts a cutback week by the school depth against the week before', () => {
        const w = layout().weeks;
        expect(Math.abs(w[3].volumeTarget - w[2].volumeTarget * 0.8)).toBeLessThanOrEqual(5);
    });
});

describe('layoutHorizon: volume targets', () => {
    it('ramps polarized from recent volume to peak in minutes, ≤ 8 % a step, then tapers', () => {
        const w = layout().weeks;
        expect(w[0]).toMatchObject({ volumeTarget: 200, volumeUnit: 'MINUTES' });
        const loading = w.filter((x) => !x.isCutback && !x.isTaper).map((x) => x.volumeTarget);
        for (let i = 1; i < loading.length; i++) {
            expect(loading[i]).toBeGreaterThanOrEqual(loading[i - 1]);
            expect(loading[i]).toBeLessThanOrEqual(Math.ceil((loading[i - 1] * 1.08) / 5) * 5);
        }
        expect(loading[loading.length - 1]).toBe(250);
        expect(w.slice(-2).map((x) => [x.volumeTarget, x.isTaper])).toEqual([
            [175, true],
            [125, true],
        ]);
    });

    it('steps Daniels by a mile per run every 3rd loading week, in metres', () => {
        const w = layout({ school: daniels, endDate: endForWeeks(18), runsPerWeek: 4 }).weeks;
        expect(w[0]).toMatchObject({ volumeTarget: 40000, volumeUnit: 'METRES' });
        expect(w[4].volumeTarget).toBe(46000); // 3 loading weeks done → +4 × 1609 m
    });

    it('scales partial opening and event weeks by their days in the horizon', () => {
        const l = layout({ startDate: '2026-10-14', endDate: '2027-01-30' });
        expect(l.weeks).toHaveLength(16);
        expect(l.weeks[0]).toMatchObject({ startDate: '2026-10-12', endDate: '2026-10-18', inHorizonDays: 5 });
        expect(l.weeks[0].volumeTarget).toBe(145); // 200 × 5/7, rounded to 5
        expect(l.weeks[15].inHorizonDays).toBe(6);
        expect(l.phases[0].startDate).toBe('2026-10-14');
        expect(l.phases[l.phases.length - 1].endDate).toBe('2027-01-30');
    });
});

describe('layoutHorizon: Monday snapping', () => {
    it('puts every interior phase boundary on a Monday, contiguous with the phase before', () => {
        const l = layout({ startDate: '2026-10-15', endDate: '2027-04-17', school: daniels });
        for (let i = 1; i < l.phases.length; i++) {
            expect(isMonday(l.phases[i].startDate)).toBe(true);
            expect(l.phases[i].startDate).toBe(addDays(l.phases[i - 1].endDate, 1));
        }
        for (const w of l.weeks) {
            expect(isMonday(w.startDate)).toBe(true);
            expect(w.endDate).toBe(addDays(w.startDate, 6));
        }
    });
});

describe('layoutHorizon: strength targets', () => {
    it('writes 2 in base, 1 on cutback and taper, 0 in race week', () => {
        const w = layout().weeks;
        expect([w[0], w[3], w[14], w[15]].map((x) => x.strengthSessionTarget)).toEqual([2, 1, 1, 0]);
    });

    it('keeps one lift in the last week when the goal is not a race', () => {
        const w = layout({ goal: { isRace: false, distanceM: null } }).weeks;
        expect(w[15].strengthSessionTarget).toBe(1);
    });

    it('turns the gym level into each week type target', () => {
        const at = (gymLevel: GymLevel) =>
            [0, 3, 14, 15].map((i) => layout({ gymLevel }).weeks[i].strengthSessionTarget);
        expect(at('NONE')).toEqual([0, 0, 0, 0]);
        expect(at('MINIMAL')).toEqual([1, 1, 1, 0]);
        expect(at('STANDARD')).toEqual([2, 1, 1, 0]);
        expect(at('MORE')).toEqual([3, 2, 1, 0]);
    });

    it('writes 1 in a sharpening phase', () => {
        const w = layout({ school: daniels, endDate: endForWeeks(18) }).weeks;
        expect(w[12].strengthSessionTarget).toBe(1); // Final Quality, loading week
        expect(w[6].strengthSessionTarget).toBe(2); // Transition Quality
    });
});

describe('layoutHorizon: time trial', () => {
    it.each([
        ['anchor present', { anchorPresent: true }, null],
        ['no anchor, lead-in', { anchorPresent: false, endDate: endForWeeks(20) }, { weekIndex: 3, distanceM: 5000 }],
        ['no anchor, bridge', { anchorPresent: false, endDate: endForWeeks(17) }, { weekIndex: 0, distanceM: 5000 }],
        ['no anchor, no lead-in', { anchorPresent: false }, { weekIndex: 0, distanceM: 5000 }],
        [
            'no anchor, marathon goal',
            { anchorPresent: false, endDate: endForWeeks(20), goal: { isRace: true, distanceM: 42195 } },
            { weekIndex: 3, distanceM: 10000 },
        ],
    ])('%s', (_, overrides, expected) => {
        expect(layout(overrides as Partial<LayoutInput>).timeTrial).toEqual(expected);
    });
});
