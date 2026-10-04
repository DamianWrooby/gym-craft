import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';

vi.mock('$app/stores', async () => {
    const { writable } = await import('svelte/store');
    const plan = {
        id: 'plan-1',
        name: 'P',
        description: '',
        workouts: [{ dayOfWeek: 'monday', workoutName: 'Leg day' }],
    };
    return { page: writable({ data: { user: { id: 'user-1' }, plan } }) };
});
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/utils/toasts', () => ({ makeToast: vi.fn() }));
vi.mock('$lib/utils/sanitize', () => ({ sanitizeObject: (o: unknown) => o }));
vi.mock('$lib/components/plan-description/PlanDescription.svelte', async () => ({
    default: (await import('./PlanDescriptionStub.test.svelte')).default,
}));
vi.mock('@skeletonlabs/skeleton', () => ({
    getToastStore: () => ({ trigger: vi.fn() }),
    // Confirm every modal at once, so the upload flow runs end to end.
    getModalStore: () => ({ trigger: (settings: { response?: (r: boolean) => void }) => settings.response?.(true) }),
}));

import PlanPage from './+page.svelte';

const fetchMock = vi.fn();

function respond(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation((url: string) => {
        if (url.endsWith('/garmin/check-email')) return respond({ email: 'a@b.c' });
        if (url.endsWith('/garmin/upload-workout')) return respond({ status: 'success' });
        return respond({}, 404);
    });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe('plan page — Garmin upload', () => {
    it('shows the Garmin Connect note after a successful upload', async () => {
        render(PlanPage);
        expect(screen.queryByRole('status')).toBeNull();

        await fireEvent.click(screen.getByRole('button', { name: 'Send to Garmin' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Leg day is now in your Garmin Connect account');
    });

    it('shows no note when the upload fails', async () => {
        fetchMock.mockImplementation((url: string) =>
            url.endsWith('/garmin/check-email') ? respond({ email: 'a@b.c' }) : respond({ message: 'boom' }, 500),
        );
        render(PlanPage);

        await fireEvent.click(screen.getByRole('button', { name: 'Send to Garmin' }));
        await new Promise((r) => setTimeout(r, 20));

        expect(screen.queryByRole('status')).toBeNull();
    });
});
