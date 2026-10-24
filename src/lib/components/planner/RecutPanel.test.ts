import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn(async () => undefined) }));
const client = vi.hoisted(() => ({ recutPlan: vi.fn() }));
vi.mock('$lib/planner/adapt-client', () => client);

import RecutPanel from './RecutPanel.svelte';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const props = { userId: 'user-1', endDate: '2027-03-07', schoolId: 'POLARIZED' as const, open: true };
const relaid = { kind: 'relaid', summary: 'Weeks 3–20 will be re-laid under Daniels.', losses: [] };

describe('RecutPanel', () => {
    it('shows the cost of a school change, then applies it on confirm', async () => {
        client.recutPlan.mockResolvedValueOnce({ applied: false, ...relaid });
        client.recutPlan.mockResolvedValueOnce({ applied: true, ...relaid });
        render(RecutPanel, props);

        await fireEvent.change(screen.getByLabelText('Training school'), { target: { value: 'DANIELS' } });
        await fireEvent.click(screen.getByRole('button', { name: 'Show what changes' }));
        expect(await screen.findByText(relaid.summary)).toBeInTheDocument();
        expect(client.recutPlan).toHaveBeenLastCalledWith('user-1', { schoolId: 'DANIELS' }, false);

        await fireEvent.click(screen.getByRole('button', { name: 'Confirm recut' }));
        expect(client.recutPlan).toHaveBeenLastCalledWith('user-1', { schoolId: 'DANIELS' }, true);
        expect(await screen.findByRole('status')).toHaveTextContent(relaid.summary);
    });

    it('offers nothing to check until something changes', () => {
        render(RecutPanel, props);
        expect(screen.getByRole('button', { name: 'Show what changes' })).toBeDisabled();
    });

    it('shows a refusal', async () => {
        client.recutPlan.mockResolvedValueOnce({ error: 'Weeks up to 2026-10-25 are already written.' });
        render(RecutPanel, props);
        await fireEvent.input(screen.getByLabelText('Goal date'), { target: { value: '2026-10-20' } });
        await fireEvent.click(screen.getByRole('button', { name: 'Show what changes' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('already written');
    });
});
