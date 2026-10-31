import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
    goto: vi.fn(async () => undefined),
    invalidateAll: vi.fn(async () => undefined),
}));
vi.mock('$app/navigation', () => navigation);
const client = vi.hoisted(() => ({ abandonPlan: vi.fn() }));
vi.mock('$lib/planner/adapt-client', () => client);

import StartOverPanel from './StartOverPanel.svelte';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const props = { userId: 'user-1', revisions: { used: 1, cap: 4 } };

describe('StartOverPanel', () => {
    it('confirms, abandons the plan and opens the setup', async () => {
        client.abandonPlan.mockResolvedValueOnce({ ok: true });
        render(StartOverPanel, props);

        await fireEvent.click(screen.getByRole('button', { name: 'Start a new plan' }));
        expect(screen.getByText(/uses 1 of your 3 plan revisions/)).toBeInTheDocument();
        await fireEvent.click(screen.getByRole('button', { name: 'End plan and start again' }));

        expect(client.abandonPlan).toHaveBeenCalledWith('user-1');
        await vi.waitFor(() => expect(navigation.goto).toHaveBeenCalledWith('/app/plan/setup'));
    });

    it('cannot confirm with no revisions left', async () => {
        render(StartOverPanel, { ...props, revisions: { used: 4, cap: 4 } });
        await fireEvent.click(screen.getByRole('button', { name: 'Start a new plan' }));
        expect(screen.getByRole('button', { name: 'End plan and start again' })).toBeDisabled();
    });

    it('shows a refusal and stays on the plan', async () => {
        client.abandonPlan.mockResolvedValueOnce({ error: 'You used all 4 plan revisions this month.' });
        render(StartOverPanel, props);
        await fireEvent.click(screen.getByRole('button', { name: 'Start a new plan' }));
        await fireEvent.click(screen.getByRole('button', { name: 'End plan and start again' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('You used all 4');
        expect(navigation.goto).not.toHaveBeenCalled();
    });
});
