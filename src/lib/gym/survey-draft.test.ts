import { beforeEach, describe, expect, it } from 'vitest';

import { clearSurveyDraft, saveSurveyDraft, takeSurveyDraft } from './survey-draft';
import type { SurveyFormModel } from '@/models/survey/survey-form.model';

const draft = { personalInfo: { sex: 'female', age: 31 } } as unknown as SurveyFormModel;

beforeEach(() => {
    sessionStorage.clear();
});

describe('survey draft', () => {
    it('round-trips a parked draft', () => {
        saveSurveyDraft(draft);
        expect(takeSurveyDraft()).toEqual(draft);
    });

    it('restores the draft only once', () => {
        saveSurveyDraft(draft);
        takeSurveyDraft();
        expect(takeSurveyDraft()).toBeNull();
    });

    it('returns null when nothing was parked', () => {
        expect(takeSurveyDraft()).toBeNull();
    });

    it('discards an unparsable draft instead of throwing', () => {
        sessionStorage.setItem('gymcraft:survey-draft', '{not json');
        expect(takeSurveyDraft()).toBeNull();
    });

    it('clears a parked draft', () => {
        saveSurveyDraft(draft);
        clearSurveyDraft();
        expect(takeSurveyDraft()).toBeNull();
    });
});
