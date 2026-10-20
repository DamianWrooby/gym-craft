import { describe, expect, it } from 'vitest';
import { formatVolume, toPlanView, type StoredPlan } from './plan-view';

const week = (startDate: string, endDate: string, generation: 'PENDING' | 'GENERATED' | 'FAILED' = 'PENDING') => ({
    id: `week-${startDate}`,
    startDate,
    endDate,
    inHorizonDays: 7,
    generation,
    isCutback: false,
    isTaper: false,
    timeTrialDistanceM: null,
    volumeTarget: 200,
    volumeUnit: 'MINUTES' as const,
    strengthSessionTarget: 2,
    sessions: [],
    request: null,
});

const plan: StoredPlan = {
    id: 'p1',
    startDate: '2026-10-12',
    endDate: '2026-11-01',
    goalId: 'g1',
    goalName: 'City Half',
    rationale: null,
    phases: [
        {
            ordinal: 0,
            name: 'Lead-in (GymCraft)',
            intent: 'x',
            source: 'LEAD_IN',
            school: 'DANIELS',
            startDate: '2026-10-12',
            endDate: '2026-10-18',
            weeks: [week('2026-10-12', '2026-10-18', 'GENERATED')],
        },
        {
            ordinal: 1,
            name: 'Final Quality',
            intent: 'y',
            source: 'SCHOOL',
            school: 'DANIELS',
            startDate: '2026-10-19',
            endDate: '2026-11-01',
            weeks: [week('2026-10-19', '2026-10-25'), week('2026-10-26', '2026-11-01', 'FAILED')],
        },
    ],
};

describe('toPlanView', () => {
    it('numbers weeks across phases, finds the current week and the school from its phases', () => {
        const v = toPlanView(plan, [], '2026-10-21');
        expect(v.weeks.map((w) => [w.index, w.phaseOrdinal, w.generation])).toEqual([
            [0, 0, 'GENERATED'],
            [1, 1, 'PENDING'],
            [2, 1, 'FAILED'],
        ]);
        expect(v.phases[1].weekIndexes).toEqual([1, 2]);
        expect(v.currentWeekIndex).toBe(1);
        expect(v.school.name).toBe('Daniels');
    });

    it('carries taper and time-trial facts through to the view', () => {
        const withTrial: StoredPlan = {
            ...plan,
            phases: [
                {
                    ...plan.phases[0],
                    weeks: [{ ...plan.phases[0].weeks[0], isTaper: true, timeTrialDistanceM: 5000 }],
                },
                plan.phases[1],
            ],
        };
        expect(toPlanView(withTrial, [], '2026-10-12').weeks[0]).toMatchObject({
            isTaper: true,
            timeTrialDistanceM: 5000,
        });
    });

    it('offers a pull for the next unwritten week, listing unconfirmed past sessions', () => {
        const session = (id: string, scheduledDate: string, status: 'PLANNED' | 'DONE') => ({
            id,
            kind: 'RUNNING' as const,
            scheduledDate,
            sequence: 0,
            status,
            plannedLoad: 50,
            staleAnchor: false,
            body: { bodyVersion: 1 } as never,
        });
        const written = structuredClone(plan);
        written.phases[0].weeks[0].request = { id: 'r1', status: 'DONE', retriesLeft: 2 };
        written.phases[0].weeks[0].sessions = [
            session('s1', '2026-10-13', 'PLANNED'),
            session('s2', '2026-10-15', 'DONE'),
            session('s3', '2026-10-17', 'PLANNED'),
        ];
        const v = toPlanView(written, [], '2026-10-16');
        expect(v.pull?.weekIndex).toBe(1);
        expect(v.pull?.unconfirmed.map((s) => s.id)).toEqual(['s1']);

        written.phases[1].weeks[0].request = { id: 'r2', status: 'PENDING', retriesLeft: 2 };
        expect(toPlanView(written, [], '2026-10-16').pull).toBeNull();
    });

    it('has no current week outside the horizon', () => {
        expect(toPlanView(plan, [], '2026-11-02').currentWeekIndex).toBeNull();
    });

    it('derives tune-up fixtures from other dated goals', () => {
        const v = toPlanView(
            plan,
            [{ id: 'g2', date: '2026-10-24', name: 'Parkrun PB', distanceM: 5000 }],
            '2026-10-12',
        );
        expect(v.fixtures).toEqual([
            { goalId: 'g2', date: '2026-10-24', name: 'Parkrun PB', distanceM: 5000, weekIndex: 1 },
        ]);
    });
});

describe('formatVolume', () => {
    it.each([
        [45, 'MINUTES', '45 min'],
        [200, 'MINUTES', '3 h 20 min'],
        [46000, 'METRES', '46 km'],
        [40500, 'METRES', '40.5 km'],
    ] as const)('%i %s → %s', (value, unit, expected) => {
        expect(formatVolume(value, unit)).toBe(expected);
    });
});
