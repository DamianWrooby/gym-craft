import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';

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
vi.mock('$lib/utils/toasts', () => ({ makeToast: vi.fn() }));

// Loading store used in the component
vi.mock('@/stores', () => ({ loadingState: writable(false) }));
import { loadingState } from '@/stores';

// Keep real component for Loader/SurveyForm; no behavior needed for this test
import CreatePlanPage from './+page.svelte';
import { page as pageStore } from '$app/stores';

describe('create-plan +page.svelte', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (pageStore as any).set({ data: { user: { session: 'sess', plansLeft: 1 } } });
        loadingState.set(false);
    });

    it('shows Loader when loadingState is true and hides survey form', async () => {
        loadingState.set(true);

        const { getByTestId } = render(CreatePlanPage);

        await waitFor(() => {
            expect(getByTestId('spinner')).toBeInTheDocument();
        });

        expect(
            screen.queryByText('Fill out the survey and generate a training plan tailored to your goals'),
        ).not.toBeInTheDocument();
    });

    it('shows SurveyForm when loadingState is false and hides loader', async () => {
        (pageStore as any).set({ data: { user: { session: 'sess', plansLeft: 1 } } });
        loadingState.set(false);

        const { getAllByText } = render(CreatePlanPage);

        await waitFor(() => {
            expect(
                getAllByText('Fill out the survey and generate a training plan tailored to your goals')[0],
            ).toBeInTheDocument();
        });

        expect(screen.queryByRole('status')).toBeNull();
    });
});
