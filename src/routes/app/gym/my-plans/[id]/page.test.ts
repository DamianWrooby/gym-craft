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
vi.mock('$lib/garmin/authenticate', () => ({
    authenticateGarmin: vi.fn().mockResolvedValue({ ok: true, sessionToken: 'fresh' }),
}));
vi.mock('@skeletonlabs/skeleton', () => ({
    getToastStore: () => ({ trigger: vi.fn() }),
    // Confirm every modal at once; the Garmin login modal answers with valid credentials.
    getModalStore: () => ({
        trigger: (settings: { type: string; response?: (r: unknown) => void }) =>
            settings.response?.(settings.type === 'component' ? { email: 'a@b.co', password: 'pw' } : true),
    }),
}));

import PlanPage from './+page.svelte';

const fetchMock = vi.fn();

function respond(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation((url: string) =>
        url.endsWith('/garmin/upload-workout') ? respond({ status: 'success' }) : respond({}),
    );
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
        fetchMock.mockImplementation(() => respond({ message: 'boom' }, 500));
        render(PlanPage);

        await fireEvent.click(screen.getByRole('button', { name: 'Send to Garmin' }));
        await new Promise((r) => setTimeout(r, 20));

        expect(screen.queryByRole('status')).toBeNull();
    });

    it('asks for a Garmin login on INVALID_TOKEN, then uploads with the new session', async () => {
        let uploads = 0;
        fetchMock.mockImplementation((url: string) => {
            if (!url.endsWith('/garmin/upload-workout')) return respond({});
            uploads += 1;
            return uploads === 1
                ? respond({ code: 'INVALID_TOKEN', message: 'stored Garmin authorization is no longer usable' }, 401)
                : respond({ status: 'success' });
        });
        render(PlanPage);

        await fireEvent.click(screen.getByRole('button', { name: 'Send to Garmin' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Leg day');
        expect(uploads).toBe(2);
        expect(fetchMock).toHaveBeenCalledWith('/api/user/user-1/garmin/save-email', expect.anything());
    });
});
