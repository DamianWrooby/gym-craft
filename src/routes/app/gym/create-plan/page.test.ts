import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/svelte';
import { writable, type Writable } from 'svelte/store';

// Mocks for SvelteKit environment and dependencies
vi.mock('$app/stores', () => {
    const user = { session: 'sess', plansLeft: 0 };
    const page = writable({ data: { user } });
    return { page };
});

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

vi.mock('@skeletonlabs/skeleton', () => {
    const toastTrigger = vi.fn();
    const getToastStore = vi.fn().mockReturnValue({ trigger: toastTrigger });
    const getModalStore = vi.fn().mockReturnValue({ trigger: vi.fn() });
    return { getToastStore, getModalStore };
});
vi.mock('$lib/utils/toasts', () => ({ makeToast: vi.fn(), makeUpgradeToast: vi.fn() }));
import { makeToast } from '$lib/utils/toasts';

// The page shows the loader while the plan job runs.
vi.mock('$lib/gym/plan-job', async () => {
    const { writable } = await import('svelte/store');
    return { planJobRunning: writable(false), startPlanJob: vi.fn() };
});
import { planJobRunning } from '$lib/gym/plan-job';
const jobRunning = planJobRunning as unknown as Writable<boolean>;

// Keep real component for Loader/SurveyForm; no behavior needed for this test
import CreatePlanPage from './+page.svelte';
import { page as pageStore } from '$app/stores';

describe('create-plan +page.svelte', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        (pageStore as any).set({ data: { user: { session: 'sess', plansLeft: 1 } } });
        jobRunning.set(false);
    });

    it('shows Loader while the plan job runs and hides survey form', async () => {
        jobRunning.set(true);

        const { getByTestId } = render(CreatePlanPage);

        await waitFor(() => {
            expect(getByTestId('spinner')).toBeInTheDocument();
        });

        expect(
            screen.queryByText('Fill out the survey and generate a training plan tailored to your goals'),
        ).not.toBeInTheDocument();
    });

    it('shows SurveyForm when no plan job runs and hides loader', async () => {
        (pageStore as any).set({ data: { user: { session: 'sess', plansLeft: 1 } } });
        jobRunning.set(false);

        const { getAllByText } = render(CreatePlanPage);

        await waitFor(() => {
            expect(
                getAllByText('Fill out the survey and generate a training plan tailored to your goals')[0],
            ).toBeInTheDocument();
        });

        expect(screen.queryByRole('status')).toBeNull();
    });

    // The draft is parked when an expired session bounces a generation attempt. Restoring it
    // silently looks identical to losing it, so the page has to say something.
    it('toasts when the survey restores a parked draft', async () => {
        sessionStorage.setItem('gymcraft:survey-draft', JSON.stringify({ personalInfo: { sex: 'female', age: 31 } }));

        render(CreatePlanPage);

        await waitFor(() => {
            expect(makeToast).toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining('restored your previous answers'),
                'variant-filled-success',
            );
        });
    });

    it('stays quiet when there is no parked draft', async () => {
        render(CreatePlanPage);

        await waitFor(() => {
            expect(
                screen.getAllByText('Fill out the survey and generate a training plan tailored to your goals')[0],
            ).toBeInTheDocument();
        });

        expect(makeToast).not.toHaveBeenCalled();
    });
});
