import { describe, expect, it } from 'vitest';
import { getSchool } from '../schools/catalogue';
import { athleteSessionsAsk, downgradeSteps, resolveConflict, type ConflictSession } from './conflict';

const school = getSchool('POLARIZED');

const run = (title: string, plannedLoad: number, tags: { key?: string; cut?: string } = {}): ConflictSession => ({
    title,
    kind: 'RUNNING',
    plannedLoad,
    method: 'LABEL_TABLE',
    keySession: tags.key ?? null,
    cutKey: tags.cut ?? null,
    canDowngrade: tags.key === 'hard',
});
const lift = (plannedLoad: number): ConflictSession => ({
    title: 'Lift',
    kind: 'STRENGTH',
    plannedLoad,
    method: 'DURATION',
    keySession: null,
    cutKey: null,
    canDowngrade: false,
});

// 400 TRIMP: hard 120, long 150, foundation 60, recovery 30, lift 40.
const week = [
    run('Intervals', 120, { key: 'hard' }),
    run('Long run', 150, { key: 'long' }),
    run('Foundation', 60, { cut: 'foundation' }),
    run('Recovery', 30, { cut: 'recovery' }),
    lift(40),
];

describe('resolveConflict', () => {
    it('is ungated without a budget', () => {
        expect(resolveConflict(week, null, school)).toEqual({ kind: 'ungated' });
    });

    it('changes nothing within the budget', () => {
        expect(resolveConflict(week, 400, school)).toEqual({ kind: 'within' });
    });

    it.each([
        { name: 'the recovery run alone', budget: 380, removed: [3] },
        { name: 'recovery, then foundation', budget: 320, removed: [3, 2] },
    ])('trims easy volume in cut order: $name', ({ budget, removed }) => {
        const result = resolveConflict(week, budget, school);
        expect(result.kind).toBe('trim');
        if (result.kind !== 'trim') return;
        expect(result.removed).toEqual(removed);
    });

    it('states the numbers, the action, why and what was protected on a trim', () => {
        const result = resolveConflict(week, 380, school);
        expect(result.kind === 'trim' && result.facts).toEqual({
            plannedTotal: 400,
            budget: 380,
            overspend: 20,
            stillOver: 0,
            removed: [{ title: 'Recovery', plannedLoad: 30, cutKey: 'recovery' }],
            offered: null,
            cutOrder: ['recovery', 'foundation'],
            protected: ['Intervals', 'Long run'],
            fallbackShare: 0.1,
        });
    });

    it('says how far over a week stays when no key session is left to ask about', () => {
        const result = resolveConflict([week[3], week[4]], 50, school);
        expect(result.kind === 'trim' && result.facts).toMatchObject({
            removed: [{ title: 'Recovery' }],
            stillOver: 0,
        });
        const stillOver = resolveConflict([week[3], week[4]], 20, school);
        expect(stillOver.kind === 'trim' && stillOver.facts.stillOver).toBe(20);
    });

    it('asks before a key session goes, offering drop, downgrade or keep', () => {
        const result = resolveConflict(week, 300, school);
        expect(result.kind).toBe('ask');
        if (result.kind !== 'ask') return;
        expect(result.removed).toEqual([3, 2]);
        expect(result.keySessionIndex).toBe(0);
        expect(result.schoolFit).toBe(false);
        expect(result.facts).toMatchObject({
            plannedTotal: 400,
            budget: 300,
            overspend: 100,
            offered: { title: 'Intervals', plannedLoad: 120, options: ['DROP', 'DOWNGRADE', 'KEEP'] },
            cutOrder: ['recovery', 'foundation'],
            protected: ['Long run'],
        });
    });

    it('offers no downgrade when the key session cannot be downgraded', () => {
        const noDowngrade = week.map((s) => ({ ...s, canDowngrade: false }));
        const result = resolveConflict(noDowngrade, 300, school);
        expect(result.kind === 'ask' && result.facts.offered?.options).toEqual(['DROP', 'KEEP']);
    });

    it('asks about the long run only when it is the only key session', () => {
        const result = resolveConflict([week[1], week[3]], 100, school);
        expect(result.kind === 'ask' && result.facts.offered?.title).toBe('Long run');
    });

    it('raises a school-fit warning when key sessions alone exceed the budget', () => {
        const result = resolveConflict(week, 250, school);
        expect(result.kind === 'ask' && result.schoolFit).toBe(true);
    });
});

describe('downgradeSteps', () => {
    it('moves every step one intensity label down, keeping the easiest as it is', () => {
        expect(
            downgradeSteps(
                [
                    { label: 'z1', durationSec: 600 },
                    {
                        repeat: 4,
                        steps: [
                            { label: 'z3', durationSec: 240, target: { type: 'HR', lowerBpm: 170, upperBpm: 185 } },
                            { label: 'z1', durationSec: 120 },
                        ],
                    },
                ],
                school,
            ),
        ).toEqual([
            { label: 'z1', durationSec: 600 },
            {
                repeat: 4,
                steps: [
                    { label: 'z2', durationSec: 240 },
                    { label: 'z1', durationSec: 120 },
                ],
            },
        ]);
    });
});

describe('athleteSessionsAsk', () => {
    const totals = { executedLoad: 200, budget: 300 };

    it('offers the hardest non-long key session and removes nothing', () => {
        const ask = athleteSessionsAsk(week, totals, school);
        expect(ask.removed).toEqual([]);
        expect(ask.keySessionIndex).toBe(0);
        expect(ask.schoolFit).toBe(false);
        expect(ask.facts).toMatchObject({
            plannedTotal: 600,
            budget: 300,
            overspend: 300,
            stillOver: 300,
            removed: [],
            offered: { title: 'Intervals', plannedLoad: 120, options: ['DROP', 'DOWNGRADE', 'KEEP'] },
            protected: ['Long run'],
        });
    });

    it('offers the biggest session when none is key, without a downgrade it cannot make', () => {
        const ask = athleteSessionsAsk([week[2], week[3], week[4]], totals, school);
        expect(ask.keySessionIndex).toBe(0);
        expect(ask.facts.offered).toEqual({ title: 'Foundation', plannedLoad: 60, options: ['DROP', 'KEEP'] });
        expect(ask.facts.protected).toEqual([]);
    });
});
