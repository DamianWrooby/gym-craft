import { describe, expect, it } from 'vitest';
import { canFinish, firstBlockedStep, initialWizardState, stepIssue, type WizardState } from './wizard';
import { zonesFromMaxHr } from './core/zones';

function complete(overrides: Partial<WizardState> = {}): WizardState {
    return {
        ...initialWizardState(zonesFromMaxHr(190)),
        goalId: 'g1',
        goalDate: '2027-03-01',
        schoolId: 'POLARIZED',
        zonesConfirmed: true,
        ...overrides,
    };
}

describe('wizard step gating', () => {
    it('finishes when every step is satisfied', () => {
        expect(canFinish(complete())).toBe(true);
    });

    it('does not finish without zone confirmation, even with prefilled zones', () => {
        const s = complete({ zonesConfirmed: false });
        expect(canFinish(s)).toBe(false);
        expect(firstBlockedStep(s)).toBe('zones');
    });

    it('does not finish with invalid zones', () => {
        expect(firstBlockedStep(complete({ zones: null }))).toBe('zones');
    });

    it('needs an end date for an undated goal, and not for a dated one', () => {
        expect(stepIssue('horizon', complete({ goalDate: null }))).toBeTruthy();
        expect(stepIssue('horizon', complete({ goalDate: null, endDate: '2027-01-31' }))).toBeNull();
    });

    it('blocks the horizon step while the layout is refused', () => {
        expect(firstBlockedStep(complete({ layoutRefused: true }))).toBe('horizon');
    });

    it('lets the athlete finish without race results', () => {
        expect(stepIssue('results', complete({ raceResults: [] }))).toBeNull();
    });

    it('requires the long-run day to be a training day', () => {
        const s = complete({ longRunDay: 1 }); // Tuesday is off by default
        expect(firstBlockedStep(s)).toBe('availability');
    });

    it('checks steps in wizard order', () => {
        expect(firstBlockedStep(complete({ goalId: null, zonesConfirmed: false }))).toBe('goal');
    });
});
