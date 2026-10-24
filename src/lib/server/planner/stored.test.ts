import { describe, expect, it } from 'vitest';
import {
    keySessionOf,
    plannedMethodOf,
    readAnchor,
    readConflict,
    readRevisionCause,
    readRevisionReason,
    readRevisionScope,
    readRunningBody,
    titleOf,
} from './stored';

const reason = {
    executedLoad: 120,
    remainingLoad: 80,
    budget: 180,
    overspend: 20,
    missedKeySessions: ['Tempo'],
    outcome: 'revise',
    scope: ['s1'],
    from: '2026-10-21',
    moved: ['Tempo moved from Tuesday to Thursday.'],
};

describe('readRevisionReason', () => {
    it('reads a stored verdict', () => {
        expect(readRevisionReason(reason)).toEqual(reason);
    });

    it('reads a verdict stored before moved lines existed as moving nothing', () => {
        const { moved, ...older } = reason;
        expect(moved).toHaveLength(1);
        expect(readRevisionReason(older)).toEqual({ ...older, moved: [] });
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

describe('readConflict', () => {
    it('reads a stored record', () => {
        const record = { placement: null, budget: { kind: 'ASK' } };
        expect(readConflict(record)).toEqual(record);
    });

    it('returns null for nothing or a malformed row', () => {
        expect(readConflict(null)).toBeNull();
        expect(readConflict({ budget: { kind: 'MAYBE' } })).toBeNull();
    });
});

describe('readRunningBody', () => {
    it('reads a running body with steps', () => {
        const body = { title: 'Tempo', steps: [] };
        expect(readRunningBody('RUNNING', body)).toBe(body);
    });

    it('returns null for another kind or a body without steps', () => {
        expect(readRunningBody('STRENGTH', { steps: [] })).toBeNull();
        expect(readRunningBody('RUNNING', { title: 'Tempo' })).toBeNull();
    });
});

describe('readAnchor', () => {
    it('reads the anchor a prompt was built with', () => {
        const anchor = { provenance: 'RACE' };
        expect(readAnchor({ anchor })).toBe(anchor);
    });

    it('returns null without one', () => {
        expect(readAnchor({ system: 'x' })).toBeNull();
        expect(readAnchor(null)).toBeNull();
    });
});

describe('plannedMethodOf', () => {
    it('keeps a planned method and reads an executed one as a duration', () => {
        expect(plannedMethodOf('LABEL_TABLE')).toBe('LABEL_TABLE');
        expect(plannedMethodOf('EDWARDS')).toBe('DURATION');
    });
});
