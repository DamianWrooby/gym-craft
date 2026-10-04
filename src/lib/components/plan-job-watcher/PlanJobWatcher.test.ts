import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';

const mocks = vi.hoisted(() => ({
    handler: null as null | ((outcome: unknown) => void),
    goto: vi.fn(),
    makeToast: vi.fn(),
    makePlanReadyToast: vi.fn(),
    saveSurveyDraft: vi.fn(),
    path: '/app',
}));

vi.mock('$app/stores', async () => {
    const { readable } = await import('svelte/store');
    return {
        page: readable({
            get url() {
                return { pathname: mocks.path };
            },
        }),
    };
});
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('@skeletonlabs/skeleton', () => ({ getToastStore: () => ({}) }));
vi.mock('$lib/utils/toasts', () => ({ makeToast: mocks.makeToast, makePlanReadyToast: mocks.makePlanReadyToast }));
vi.mock('$lib/gym/survey-draft', () => ({ saveSurveyDraft: mocks.saveSurveyDraft }));
vi.mock('$lib/gym/plan-job', () => ({
    onPlanJobFinished: (handler: (outcome: unknown) => void) => {
        mocks.handler = handler;
        return () => (mocks.handler = null);
    },
    planFailureMessage: (code: string) => `failed: ${code}`,
}));

import PlanJobWatcher from './PlanJobWatcher.svelte';

function finish(outcome: unknown, path: string) {
    mocks.path = path;
    render(PlanJobWatcher);
    mocks.handler?.(outcome);
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('PlanJobWatcher', () => {
    it('opens the plan when the user is still on create-plan', () => {
        finish({ status: 'done', planId: 'p1' }, '/app/gym/create-plan');
        expect(mocks.goto).toHaveBeenCalledWith('/app/gym/my-plans/p1');
        expect(mocks.makePlanReadyToast).not.toHaveBeenCalled();
    });

    it('shows a toast with a link when the user is elsewhere', () => {
        finish({ status: 'done', planId: 'p1' }, '/app/running');
        expect(mocks.makePlanReadyToast).toHaveBeenCalledWith(expect.anything(), '/app/gym/my-plans/p1');
        expect(mocks.goto).not.toHaveBeenCalled();
    });

    it('parks the survey and sends the user to login on an expired session', () => {
        const formData = { a: 1 };
        finish({ status: 'failed', code: 'INVALID_SESSION', message: 'x', formData }, '/app/running');
        expect(mocks.saveSurveyDraft).toHaveBeenCalledWith(formData);
        expect(mocks.goto).toHaveBeenCalledWith('/app/login');
    });

    it('shows the failure and leaves create-plan on other failures', () => {
        finish({ status: 'failed', code: 'PROXY_ERROR', message: 'x', formData: {} }, '/app/gym/create-plan');
        expect(mocks.makeToast).toHaveBeenCalledWith(expect.anything(), 'failed: PROXY_ERROR', 'variant-filled-error');
        expect(mocks.goto).toHaveBeenCalledWith('/app');
    });

    it('stops listening when unmounted', () => {
        render(PlanJobWatcher);
        cleanup();
        expect(mocks.handler).toBeNull();
    });
});
