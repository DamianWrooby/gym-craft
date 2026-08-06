import type { SurveyFormModel } from '@/models/survey/survey-form.model';

const DRAFT_KEY = 'gymcraft:survey-draft';

/**
 * A rejected session sends the user to the login page mid-flow, and the survey is six steps of
 * typing — losing it is the worst part of the failure. Park it in sessionStorage so the form can
 * pick it back up when the user returns; it dies with the tab, and it never leaves the browser.
 */
export function saveSurveyDraft(formData: SurveyFormModel): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch {
        // Private mode / quota — the draft is a convenience, never a hard requirement.
    }
}

/** Reads the parked draft and clears it, so it is restored exactly once. */
export function takeSurveyDraft(): SurveyFormModel | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        sessionStorage.removeItem(DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? (parsed as SurveyFormModel) : null;
    } catch {
        return null;
    }
}

export function clearSurveyDraft(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.removeItem(DRAFT_KEY);
    } catch {
        // ignore
    }
}
