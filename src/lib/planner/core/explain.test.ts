import { describe, expect, it } from 'vitest';
import { addDays } from '$lib/utils/iso-week';
import { getSchool } from '../schools/catalogue';
import { layoutHorizon, type LayoutInput } from './layout';
import { explainPlan, type ExplainInput, type PlanRationale } from './explain';

const MONDAY = '2026-10-12';
const endForWeeks = (n: number) => addDays(MONDAY, 7 * n - 1);

function laid(overrides: Partial<LayoutInput> = {}) {
    const result = layoutHorizon({
        school: getSchool('POLARIZED'),
        startDate: MONDAY,
        endDate: endForWeeks(16),
        goal: { isRace: true, distanceM: 21097 },
        recentVolume: { minutesPerWeek: 200, metresPerWeek: 40000 },
        runsPerWeek: 4,
        anchorPresent: true,
        ...overrides,
    });
    if (!result.ok) throw new Error(result.reason);
    return result.layout;
}

function explain(overrides: Partial<ExplainInput> = {}, layoutOverrides: Partial<LayoutInput> = {}): PlanRationale {
    return explainPlan({
        school: getSchool(layoutOverrides.school?.id ?? 'POLARIZED'),
        layout: laid(layoutOverrides),
        goal: { name: 'Warsaw Half-Marathon', date: endForWeeks(16) },
        recommended: { schoolId: 'POLARIZED', reason: 'Flexible and forgiving.' },
        anchor: {
            provenance: 'RACE_RESULT',
            sourceId: 'r1',
            date: '2026-09-27',
            distanceM: 21097,
            timeSec: 6253,
            stale: false,
        },
        recentVolume: { minutesPerWeek: 200, metresPerWeek: 40000 },
        runsPerWeek: 4,
        longRunDay: 6,
        ...overrides,
    });
}

const section = (r: PlanRationale, key: string) => {
    const s = r.sections.find((x) => x.key === key);
    if (!s) throw new Error(`no section ${key}`);
    return s.lines.join('\n');
};

describe('explainPlan', () => {
    it('says the chosen school was the recommended one, with the reason', () => {
        expect(section(explain(), 'school')).toContain(
            'You chose Polarized 80/20, the school GymCraft recommended: Flexible and forgiving.',
        );
    });

    it('names the recommendation when the athlete chose another school', () => {
        const r = explain({ recommended: { schoolId: 'DANIELS', reason: 'Paces set from your race result.' } });
        expect(section(r, 'school')).toContain(
            'GymCraft recommended Daniels (Paces set from your race result.). You chose Polarized 80/20.',
        );
    });

    it('gives the horizon length, its end and each phase', () => {
        const text = section(explain(), 'horizon');
        expect(text).toContain('16 weeks, from 2026-10-12 to race day (Warsaw Half-Marathon) on 2027-01-31.');
        expect(text).toContain('Aerobic: 14 weeks.');
        expect(text).toContain('Taper: 2 weeks.');
    });

    it('lists what a shortened phase costs', () => {
        const r = explain({}, { endDate: endForWeeks(12), compression: { aerobic: 10 } });
        expect(section(r, 'horizon')).toContain('Aerobic shortened from 14 to 10 weeks:');
    });

    it('explains a lead-in when the horizon is longer than the school needs', () => {
        const r = explain({}, { endDate: endForWeeks(20) });
        expect(section(r, 'horizon')).toContain(
            'Your horizon is 4 weeks longer than Polarized 80/20 needs, so it starts with a 4-week GymCraft lead-in',
        );
    });

    it('names the race result the paces come from', () => {
        expect(section(explain(), 'anchor')).toContain(
            'Your paces come from your half marathon on 2026-09-27 in 1:44:13.',
        );
    });

    it('names an inferred Garmin run and suggests a race result', () => {
        const r = explain({
            anchor: {
                provenance: 'INFERRED_EFFORT',
                sourceId: 'a1',
                date: '2026-10-01',
                distanceM: 12009,
                timeSec: 3720,
                stale: false,
            },
        });
        expect(section(r, 'anchor')).toContain(
            'Your paces come from your best recent Garmin run: 12.0 km on 2026-10-01 in 1:02:00.',
        );
    });

    it('points to the time-trial week when there is no anchor', () => {
        const r = explain({ anchor: null }, { anchorPresent: false });
        expect(section(r, 'anchor')).toContain('No race result or recent hard run, so week 1 has a 5 km time trial.');
    });

    it('ties week 1 volume and the peak to recent running', () => {
        const text = section(explain(), 'volume');
        expect(text).toContain('In the last 4 weeks you ran 3 h 20 min a week on average (40.0 km).');
        expect(text).toMatch(/Week 1 asks for \d+ h \d+ min; the most is .+ in week \d+\./);
    });

    it('says when there is no recent running', () => {
        const r = explain(
            { recentVolume: { minutesPerWeek: 0, metresPerWeek: 0 } },
            { recentVolume: { minutesPerWeek: 0, metresPerWeek: 0 } },
        );
        expect(section(r, 'volume')).toContain('No running in the last 4 weeks, so week 1 starts low.');
    });

    it('lists the easy and taper weeks', () => {
        const text = section(explain(), 'recovery');
        expect(text).toMatch(/Easy weeks with less volume: weeks \d+(, \d+)*\./);
        expect(text).toContain('Taper: weeks 15 and 16, so you start the race fresh.');
    });

    it('describes the training week from availability', () => {
        expect(section(explain(), 'week')).toContain('4 run days a week, with the long run on Sunday.');
    });
});
