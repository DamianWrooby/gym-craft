import { describe, expect, it } from 'vitest';
import { keySessionOf, readRevisionCause, readRevisionReason, readRevisionScope, titleOf } from './stored';

const reason = {
    executedLoad: 120,
    remainingLoad: 80,
    budget: 180,
    overspend: 20,
    missedKeySessions: ['Tempo'],
    outcome: 'revise',
    scope: ['s1'],
    from: '2026-10-21',
};

describe('readRevisionReason', () => {
    it('reads a stored verdict', () => {
        expect(readRevisionReason(reason)).toEqual(reason);
    });

    it('reads an ungated verdict', () => {
        expect(readRevisionReason({ ...reason, budget: null })).toEqual({ ...reason, budget: null });
    });

    it('returns null for nothing or a malformed row', () => {
        expect(readRevisionReason(null)).toBeNull();
        expect(readRevisionReason({ ...reason, outcome: 'maybe' })).toBeNull();
        expect(readRevisionReason({ ...reason, scope: 'all' })).toBeNull();
        expect(readRevisionReason({ ...reason, overspend: '20' })).toBeNull();
    });
});

describe('readRevisionCause', () => {
    it('reads a trigger and its references', () => {
        expect(readRevisionCause({ trigger: 'UNSCHEDULED', activityIds: ['a1'] })).toEqual({
            trigger: 'UNSCHEDULED',
            activityIds: ['a1'],
        });
        expect(readRevisionCause({ trigger: 'SESSION_DONE', plannedSessionId: 'p1' })).toEqual({
            trigger: 'SESSION_DONE',
            plannedSessionId: 'p1',
        });
    });

    it('returns null for an unknown trigger', () => {
        expect(readRevisionCause({ trigger: 'WEATHER' })).toBeNull();
        expect(readRevisionCause(null)).toBeNull();
    });
});

describe('readRevisionScope', () => {
    it('reads the scope from a revision request input', () => {
        const scope = { scope: ['s1'], from: '2026-10-21', executedLoad: 40 };
        expect(readRevisionScope({ system: 'x', revisionScope: scope })).toEqual(scope);
    });

    it('returns null for a plain week request', () => {
        expect(readRevisionScope({ system: 'x' })).toBeNull();
    });
});

describe('session body readers', () => {
    it('reads the title, with a fallback', () => {
        expect(titleOf({ title: 'Easy run' })).toBe('Easy run');
        expect(titleOf(null)).toBe('Session');
        expect(titleOf({ title: 3 })).toBe('Session');
    });

    it('reads a key session only on a running body', () => {
        expect(keySessionOf('RUNNING', { keySession: 'TEMPO' })).toBe('TEMPO');
        expect(keySessionOf('STRENGTH', { keySession: 'TEMPO' })).toBeNull();
        expect(keySessionOf('RUNNING', {})).toBeNull();
    });
});
